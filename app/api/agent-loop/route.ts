/**
 * @MODULE_ID app.api.agent-loop
 * @STAGE orchestration
 * @DATA_INPUTS ["discussion_logs (INSERT webhook)", "discussion_state", "discussion_participants", "agent_templates", "system_guidelines", "few_shot_templates"]
 * @REQUIRED_TOOLS ["@supabase/supabase-js", "@ai-sdk/groq", "@ai-sdk/openai", "ai"]
 *
 * Supabase DB Webhook target — fires on every INSERT to discussion_logs.
 * Drives the Origo sequential agent loop:
 *   1. Validate x-webhook-secret header
 *   2. Parse Supabase INSERT payload → extract discussion_id
 *   3. Read discussion_state (current_turn_index, max_rounds, status)
 *   4. Guard: bail if status != "active" or turn already processed
 *   5. Load ordered discussion_participants
 *   6. If nextRound >= max_rounds → Manager generates agent_tasks → status = "complete"
 *   7. Otherwise → determine next agent → call LLM (Groq / OpenAI fallback) →
 *      INSERT response → update discussion_state
 *
 * IMPORTANT: Never run agents in parallel. The sequential nature is enforced by
 * the turn_index idempotency guard and the discussion_state.status check.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel function timeout — groq is sub-second but task generation can take longer
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelConfig = {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
};

type AgentTemplate = {
  id: string;
  name: string;
  engine_type: string;
  system_prompt: string;
  ai_model_config: ModelConfig | null;
};

type DiscussionParticipant = {
  id: string;
  discussion_id: string;
  agent_template_id: string;
  sequence_order: number;
  agent_template: AgentTemplate | null;
};

type DiscussionStateRow = {
  id: string;
  current_turn_index: number;
  current_round: number;
  max_rounds: number;
  status: string;
};

type DiscussionLogRow = {
  id: string;
  discussion_id: string;
  agent_id: string | null;
  speaker_name: string;
  turn_index: number;
  content: string;
  message_type: string;
  created_at: string;
};

type SupabaseWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: DiscussionLogRow;
  old_record?: DiscussionLogRow | null;
};

// ---------------------------------------------------------------------------
// Admin Supabase client (bypasses RLS with service role key)
// ---------------------------------------------------------------------------

const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — " +
        "server-side DB operations require the service role key.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

// ---------------------------------------------------------------------------
// LLM call — Groq primary, OpenAI fallback
// ---------------------------------------------------------------------------

const callLLM = async ({
  systemPrompt,
  userMessage,
  modelConfig,
}: {
  systemPrompt: string;
  userMessage: string;
  modelConfig: ModelConfig;
}): Promise<string> => {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const temperature = modelConfig.temperature ?? 0.4;

  // Primary: Groq
  if (groqKey) {
    const groq = createGroq({ apiKey: groqKey });
    const model =
      modelConfig.provider.toLowerCase() === "groq"
        ? modelConfig.model
        : "llama3-70b-8192";
    const { text } = await generateText({
      model: groq(model),
      temperature,
      ...(modelConfig.maxTokens ? { maxTokens: modelConfig.maxTokens } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    return text ?? "";
  }

  // Fallback: OpenAI
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    const model =
      modelConfig.provider.toLowerCase() === "openai"
        ? modelConfig.model
        : "gpt-4o-mini";
    const { text } = await generateText({
      model: openai(model),
      temperature,
      ...(modelConfig.maxTokens ? { maxTokens: modelConfig.maxTokens } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    return text ?? "";
  }

  throw new Error(
    "No LLM provider available. Set GROQ_API_KEY (primary) or OPENAI_API_KEY (fallback).",
  );
};

// ---------------------------------------------------------------------------
// Prompt assembly helpers
// ---------------------------------------------------------------------------

const buildAgentSystemPrompt = ({
  agent,
  guidelines,
  fewShots,
  nextTurnIndex,
  totalTurns,
}: {
  agent: AgentTemplate;
  guidelines: string;
  fewShots: Array<{ input_example: string; output_example: string }>;
  nextTurnIndex: number;
  totalTurns: number;
}): string => {
  const parts: string[] = [agent.system_prompt];

  if (guidelines) {
    parts.push(`System Guidelines:\n${guidelines}`);
  }

  if (fewShots.length > 0) {
    const examples = fewShots
      .map((fs) => `Input: ${fs.input_example}\nOutput: ${fs.output_example}`)
      .join("\n---\n");
    parts.push(`Few-shot examples:\n${examples}`);
  }

  parts.push(
    `You are ${agent.name}, speaking in turn ${nextTurnIndex} of ${totalTurns} total turns.`,
    "Respond concisely and directly. Max 3-4 sentences. Stay focused on the project objective.",
    "Do not repeat what previous agents already said. Add new value.",
  );

  return parts.filter(Boolean).join("\n\n");
};

const buildManagerTasksPrompt = (agent: AgentTemplate, guidelines: string): string => {
  const parts: string[] = [
    agent.system_prompt,
    guidelines ? `System Guidelines:\n${guidelines}` : "",
    "All discussion rounds are complete. Your task now is to synthesize the discussion into actionable tasks.",
    'Format each task EXACTLY as: TASK: [short title] | DESCRIPTION: [2-3 sentences] | PRIORITY: [high|medium|low]',
    "Generate 3-5 tasks. One task per line. No preamble, no commentary.",
  ];
  return parts.filter(Boolean).join("\n\n");
};

const parseTasksFromText = (
  text: string,
): Array<{ title: string; description: string; priority: string }> => {
  return text
    .split("\n")
    .filter((line) => /^TASK:/i.test(line.trim()))
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const title = (parts[0] ?? "").replace(/^TASK:\s*/i, "").trim();
      const description = (parts[1] ?? "").replace(/^DESCRIPTION:\s*/i, "").trim();
      const priorityRaw = (parts[2] ?? "").replace(/^PRIORITY:\s*/i, "").trim().toLowerCase();
      const priority = ["high", "medium", "low"].includes(priorityRaw) ? priorityRaw : "medium";
      return { title, description: description || title, priority };
    })
    .filter((t) => t.title.length > 0);
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // ------------------------------------------------------------------
  // 1. Validate webhook secret
  //    Header: x-webhook-secret must match ORIGO_WEBHOOK_SECRET
  // ------------------------------------------------------------------
  const incomingSecret = req.headers.get("x-webhook-secret");
  const expectedSecret = process.env.ORIGO_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error("[agent-loop] ORIGO_WEBHOOK_SECRET env var is not set.");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (incomingSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ------------------------------------------------------------------
  // 2. Parse Supabase webhook payload
  // ------------------------------------------------------------------
  let body: SupabaseWebhookPayload;
  try {
    body = (await req.json()) as SupabaseWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.type !== "INSERT" || body.table !== "discussion_logs" || !body.record) {
    // Ignore non-INSERT events or unrelated tables
    return NextResponse.json({ status: "ignored", reason: "Not a discussion_logs INSERT" });
  }

  const triggeringRecord = body.record;
  const discussionId = triggeringRecord.discussion_id;

  if (!discussionId) {
    return NextResponse.json(
      { error: "Webhook record missing discussion_id" },
      { status: 400 },
    );
  }

  // ------------------------------------------------------------------
  // 3. Load discussion_state (MUST exist before any discussion_logs insert)
  // ------------------------------------------------------------------
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("[agent-loop] Admin client error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DB client init failed" },
      { status: 500 },
    );
  }

  const { data: stateData, error: stateError } = await supabase
    .from("discussion_state")
    .select("id, current_turn_index, current_round, max_rounds, status")
    .eq("id", discussionId)
    .maybeSingle();

  if (stateError || !stateData) {
    console.error("[agent-loop] discussion_state not found for", discussionId, stateError);
    return NextResponse.json(
      { error: "discussion_state not found — ensure it is seeded before first log insert" },
      { status: 404 },
    );
  }

  const state = stateData as DiscussionStateRow;

  // ------------------------------------------------------------------
  // 4. Guard: only process "active" sessions
  // ------------------------------------------------------------------
  if (state.status !== "active") {
    return NextResponse.json({
      status: "ok",
      reason: `Session is "${state.status}" — no action taken`,
    });
  }

  // ------------------------------------------------------------------
  // 5. Idempotency guard — skip already-processed turns
  //    If the triggering record's turn_index is behind the state's
  //    current_turn_index, this webhook is a duplicate / retry.
  // ------------------------------------------------------------------
  if (triggeringRecord.turn_index < state.current_turn_index) {
    return NextResponse.json({
      status: "ok",
      reason: `Turn ${triggeringRecord.turn_index} already processed (state at ${state.current_turn_index})`,
    });
  }

  // ------------------------------------------------------------------
  // 6. Load discussion_participants ordered by sequence_order
  // ------------------------------------------------------------------
  const { data: participantData, error: partError } = await supabase
    .from("discussion_participants")
    .select("id, discussion_id, agent_template_id, sequence_order, agent_template:agent_templates(*)")
    .eq("discussion_id", discussionId)
    .order("sequence_order", { ascending: true });

  if (partError || !participantData || participantData.length === 0) {
    console.error("[agent-loop] No participants:", partError);
    return NextResponse.json(
      { error: "No discussion_participants found — populate the guest list first" },
      { status: 404 },
    );
  }

  const participants = participantData as unknown as DiscussionParticipant[];
  const participantCount = participants.length;

  // ------------------------------------------------------------------
  // 7. Compute next turn
  // ------------------------------------------------------------------
  const nextTurnIndex = triggeringRecord.turn_index + 1;
  const nextParticipantIdx = nextTurnIndex % participantCount;
  const nextRound = Math.floor(nextTurnIndex / participantCount);
  const totalTurns = state.max_rounds * participantCount;

  // ------------------------------------------------------------------
  // 8. Load shared context (system_guidelines + few_shot_templates)
  //    These are injected into every agent prompt.
  // ------------------------------------------------------------------
  const [{ data: guidelineRows }, historyResult] = await Promise.all([
    supabase
      .from("system_guidelines")
      .select("content")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("discussion_logs")
      .select("speaker_name, content, turn_index, message_type")
      .eq("discussion_id", discussionId)
      .order("turn_index", { ascending: true })
      .limit(20),
  ]);

  const guidelines = (guidelineRows ?? [])
    .map((g: { content: string }) => g.content)
    .filter(Boolean)
    .join("\n");

  const historyRows = (historyResult.data ?? []) as Array<{
    speaker_name: string;
    content: string;
    turn_index: number;
    message_type: string;
  }>;

  const discussionContext = historyRows
    .map((row) => `${row.speaker_name}: ${row.content}`)
    .join("\n");

  // ------------------------------------------------------------------
  // 9. max_rounds reached → Manager generates agent_tasks → complete
  // ------------------------------------------------------------------
  if (nextRound >= state.max_rounds) {
    const managerParticipant = participants.find(
      (p) => p.agent_template?.engine_type === "manager",
    );

    if (managerParticipant?.agent_template) {
      const manager = managerParticipant.agent_template;
      const modelConfig: ModelConfig = manager.ai_model_config ?? {
        provider: "groq",
        model: "llama3-70b-8192",
        temperature: 0.3,
      };

      const systemPrompt = buildManagerTasksPrompt(manager, guidelines);
      const userMessage =
        discussionContext.length > 0
          ? `Full discussion:\n${discussionContext}\n\nGenerate the actionable tasks now.`
          : "No discussion history available. Generate general onboarding tasks.";

      let taskText = "";
      try {
        taskText = await callLLM({ systemPrompt, userMessage, modelConfig });
      } catch (llmErr) {
        console.error("[agent-loop] LLM error generating tasks:", llmErr);
        // Fallback task so the loop can still complete
        taskText =
          "TASK: Review Discussion Output | DESCRIPTION: Review the full discussion and define implementation priorities. | PRIORITY: high";
      }

      const tasks = parseTasksFromText(taskText);

      // Insert agent_tasks
      if (tasks.length > 0) {
        await supabase.from("agent_tasks").insert(
          tasks.map((task) => ({
            discussion_id: discussionId,
            assigned_agent_id: manager.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: "pending",
          })),
        );
      }

      // Insert summary log (this INSERT will fire the webhook again,
      // but status = "complete" will cause an early exit)
      await supabase.from("discussion_logs").insert({
        discussion_id: discussionId,
        agent_id: manager.id,
        speaker_name: manager.name,
        turn_index: nextTurnIndex,
        content: `[Manager Summary] All ${state.max_rounds} rounds complete. ${tasks.length} task(s) created.`,
        message_type: "system",
      });
    }

    // Mark discussion complete
    await supabase
      .from("discussion_state")
      .update({
        status: "complete",
        current_turn_index: nextTurnIndex,
        current_round: nextRound,
        updated_at: new Date().toISOString(),
      })
      .eq("id", discussionId);

    return NextResponse.json({
      status: "complete",
      discussion_id: discussionId,
      turn: nextTurnIndex,
      round: nextRound,
    });
  }

  // ------------------------------------------------------------------
  // 10. Normal turn — generate next agent response
  // ------------------------------------------------------------------
  const nextParticipant = participants[nextParticipantIdx];
  const agentTemplate = nextParticipant?.agent_template;

  if (!agentTemplate) {
    console.error("[agent-loop] No agent_template for participant at idx", nextParticipantIdx);
    return NextResponse.json(
      { error: "Agent template not found for next participant" },
      { status: 500 },
    );
  }

  // Load few-shot examples for this agent
  const { data: fewShotRows } = await supabase
    .from("few_shot_templates")
    .select("input_example, output_example")
    .eq("agent_template_id", agentTemplate.id)
    .limit(2);

  const fewShots = (fewShotRows ?? []) as Array<{
    input_example: string;
    output_example: string;
  }>;

  const modelConfig: ModelConfig = agentTemplate.ai_model_config ?? {
    provider: "groq",
    model: "llama3-70b-8192",
    temperature: 0.4,
  };

  const systemPrompt = buildAgentSystemPrompt({
    agent: agentTemplate,
    guidelines,
    fewShots,
    nextTurnIndex,
    totalTurns,
  });

  const userMessage =
    discussionContext.length > 0
      ? `Discussion so far:\n${discussionContext}\n\nYour turn, ${agentTemplate.name}. Respond now.`
      : `Begin the discussion. Introduce your perspective as ${agentTemplate.name}.`;

  // ------------------------------------------------------------------
  // 11. Call LLM
  // ------------------------------------------------------------------
  let agentResponse: string;
  try {
    agentResponse = await callLLM({ systemPrompt, userMessage, modelConfig });
  } catch (llmErr) {
    console.error("[agent-loop] LLM call failed:", llmErr);
    return NextResponse.json(
      {
        error: "LLM call failed",
        details: llmErr instanceof Error ? llmErr.message : String(llmErr),
      },
      { status: 500 },
    );
  }

  // ------------------------------------------------------------------
  // 12. Insert agent response → triggers next webhook cycle
  // ------------------------------------------------------------------
  const { error: insertError } = await supabase.from("discussion_logs").insert({
    discussion_id: discussionId,
    agent_id: agentTemplate.id,
    speaker_name: agentTemplate.name,
    turn_index: nextTurnIndex,
    content: agentResponse,
    message_type: "agent",
  });

  if (insertError) {
    console.error("[agent-loop] Failed to insert agent response:", insertError);
    return NextResponse.json({ error: "Failed to persist agent response" }, { status: 500 });
  }

  // ------------------------------------------------------------------
  // 13. Update discussion_state
  // ------------------------------------------------------------------
  await supabase
    .from("discussion_state")
    .update({
      current_turn_index: nextTurnIndex,
      current_round: nextRound,
      updated_at: new Date().toISOString(),
    })
    .eq("id", discussionId);

  return NextResponse.json({
    status: "ok",
    discussion_id: discussionId,
    turn: nextTurnIndex,
    round: nextRound,
    speaker: agentTemplate.name,
  });
}

/**
 * @MODULE_ID core.discussion-engine-v2
 * @STAGE discussion
 * @DATA_INPUTS ["projects", "agent_templates", "discussion_participants", "discussion_state", "discussion_logs"]
 * @REQUIRED_TOOLS ["ai-sdk", "supabase-js"]
 * @DESCRIPTION Refactored discussion engine using proper tables for turn-taking and persistence
 */
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

type DiscussionProject = {
  id: string;
  organization_id: string | null;
  name: string;
  type: string;
  status: string;
  metadata: unknown;
};

type DiscussionAgent = {
  id: string;
  name: string;
  level: number | null;
  system_prompt: string;
  ai_model_config: unknown;
};

type DiscussionParticipant = {
  id: string;
  project_id: string;
  agent_id: string;
  role: "manager" | "leader" | "user" | "specialist";
  sequence_order: number;
};

type DiscussionState = {
  id: string;
  project_id: string;
  current_turn_index: number;
  current_round: number;
  is_active: boolean;
};

type DiscussionLog = {
  id: string;
  project_id: string;
  agent_id: string | null;
  role: string;
  content: string;
  turn_index: number;
  round_number: number;
  created_at: string;
};

type DiscussionEntry = {
  id: string;
  type: "discussion_turn" | "discussion_summary";
  speakerKey: string;
  speakerName: string;
  speakerRole: "user" | "manager" | "expert";
  content: string;
  createdAt: string | null;
  agentTemplateId: string | null;
  level: number | null;
  keywords: string[];
};

type AdvanceDiscussionInput = {
  projectId: string;
  message: string;
  userId: string;
  organizationId?: string | null;
};

type DiscussionStateResponse = {
  project: DiscussionProject;
  entries: DiscussionEntry[];
  counts: Record<string, number>;
  speakerOrder: string[];
  nextSpeaker: string | null;
};

type DiscussionModelConfig = {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
};

// Configuration constants
const MAX_DISCUSSION_ROUNDS = 3;
const MAX_TURN_ITERATIONS = 20; // Safety limit to prevent infinite loops
const DEFAULT_STOP_SEQUENCES = ["[", "\n\n", "Speaker:"];
const GROQ_FALLBACK_CONFIG: DiscussionModelConfig = {
  provider: "groq",
  model: "llama-3.1-8b-instant",
  temperature: 0.2,
  stop: DEFAULT_STOP_SEQUENCES,
};

const openaiFactory = process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const groqFactory = process.env.GROQ_API_KEY
  ? createGroq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const asObject = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseModelConfig = (value: unknown): DiscussionModelConfig | null => {
  const record = asObject(value);
  if (!record) {
    return null;
  }

  const provider = toNonEmptyString(record.provider);
  const model = toNonEmptyString(record.model);
  if (!provider || !model) {
    return null;
  }

  const readNumber = (entry: unknown) => {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return entry;
    }
    if (typeof entry === "string") {
      const parsed = Number(entry);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };

  const temperature = readNumber(record.temperature);
  const maxTokens = readNumber(record.maxTokens) ?? readNumber(record.max_tokens);
  const topP = readNumber(record.topP) ?? readNumber(record.top_p);

  // Parse stop sequences from ai_model_config
  let stop = DEFAULT_STOP_SEQUENCES;
  if (typeof record.stop === "string") {
    stop = [record.stop];
  } else if (Array.isArray(record.stop)) {
    const parsed = record.stop
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0);
    if (parsed.length > 0) {
      stop = parsed;
    }
  }

  return {
    provider,
    model,
    stop,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    ...(topP !== undefined ? { topP } : {}),
  };
};

const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials fehlen.");
  }
  return createClient(supabaseUrl, serviceRoleKey);
};

const loadProject = async (supabase: ReturnType<typeof createSupabaseAdmin>, projectId: string) => {
  const { data, error } = await supabase
    .from("projects")
    .select("id, organization_id, name, type, status, metadata")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Diskussionsprojekt nicht gefunden.");
  }

  return data as DiscussionProject;
};

const loadOrCreateDiscussionState = async (
  supabase: ReturnType<typeof createSupabaseAdmin>,
  projectId: string,
) => {
  // Try to load existing state
  const { data: existing, error: loadError } = await supabase
    .from("discussion_state")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!loadError && existing) {
    return existing as DiscussionState;
  }

  // Create new state if doesn't exist
  const { data: created, error: createError } = await supabase
    .from("discussion_state")
    .insert({
      project_id: projectId,
      current_turn_index: 0,
      current_round: 1,
      is_active: true,
    })
    .select()
    .single();

  if (createError || !created) {
    throw new Error(createError?.message ?? "Could not create discussion state.");
  }

  return created as DiscussionState;
};

const loadParticipants = async (
  supabase: ReturnType<typeof createSupabaseAdmin>,
  projectId: string,
) => {
  const { data, error } = await supabase
    .from("discussion_participants")
    .select("*")
    .eq("project_id", projectId)
    .order("sequence_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DiscussionParticipant[];
};

const loadDiscussionLogs = async (
  supabase: ReturnType<typeof createSupabaseAdmin>,
  projectId: string,
) => {
  const { data, error } = await supabase
    .from("discussion_logs")
    .select("*")
    .eq("project_id", projectId)
    .order("round_number", { ascending: true })
    .order("turn_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DiscussionLog[];
};

const loadAgentById = async (
  supabase: ReturnType<typeof createSupabaseAdmin>,
  agentId: string,
) => {
  const { data, error } = await supabase
    .from("agent_templates")
    .select("id, name, level, system_prompt, ai_model_config")
    .eq("id", agentId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? `Agent ${agentId} not found.`);
  }

  return data as DiscussionAgent;
};

const resolveModelFactory = (config: DiscussionModelConfig) => {
  const provider = config.provider.toLowerCase();
  if (provider === "groq") {
    if (!groqFactory) {
      throw new Error("GROQ_API_KEY fehlt.");
    }
    return groqFactory(config.model);
  }
  if (provider === "openai") {
    if (!openaiFactory) {
      throw new Error("OPENAI_API_KEY fehlt.");
    }
    return openaiFactory(config.model);
  }
  if (!groqFactory) {
    throw new Error(`Provider nicht verfuegbar: ${config.provider}`);
  }
  return groqFactory(GROQ_FALLBACK_CONFIG.model);
};

const generateAgentResponse = async ({
  agent,
  conversationHistory,
  rules,
}: {
  agent: DiscussionAgent;
  conversationHistory: string;
  rules: string[];
}) => {
  const modelConfig = parseModelConfig(agent.ai_model_config) ?? GROQ_FALLBACK_CONFIG;
  const model = resolveModelFactory(modelConfig);

  const instruction = [
    agent.system_prompt,
    "Du bist in einer moderierten Diskussionsrunde.",
    rules.length > 0
      ? `Regeln:\n${rules.map((rule) => `- ${rule}`).join("\n")}`
      : "Regeln: Halte dich an kurze, taktische Aussagen.",
    "Antwortvorgabe: maximal 3 Zeilen, keine Einleitung, direkt umsetzbar.",
  ].join("\n\n");

  const { text } = await generateText({
    model,
    temperature: modelConfig.temperature ?? 0.2,
    ...(modelConfig.maxTokens !== undefined ? { maxTokens: modelConfig.maxTokens } : {}),
    ...(modelConfig.topP !== undefined ? { topP: modelConfig.topP } : {}),
    ...(modelConfig.stop !== undefined ? { stop: modelConfig.stop } : {}),
    messages: [
      { role: "system", content: instruction },
      {
        role: "user",
        content:
          conversationHistory.length > 0
            ? `Diskussionsverlauf:\n${conversationHistory}\n\nDein Beitrag jetzt.`
            : "Starte den Beitrag jetzt.",
      },
    ],
  });

  return text.trim();
};

const saveDiscussionLog = async ({
  supabase,
  projectId,
  agentId,
  role,
  content,
  turnIndex,
  roundNumber,
}: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  projectId: string;
  agentId: string | null;
  role: string;
  content: string;
  turnIndex: number;
  roundNumber: number;
}) => {
  const { data, error } = await supabase
    .from("discussion_logs")
    .insert({
      project_id: projectId,
      agent_id: agentId,
      role,
      content,
      turn_index: turnIndex,
      round_number: roundNumber,
      metadata: {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save discussion log.");
  }

  return data as DiscussionLog;
};

const updateDiscussionState = async ({
  supabase,
  projectId,
  turnIndex,
  round,
  isActive,
}: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  projectId: string;
  turnIndex: number;
  round: number;
  isActive: boolean;
}) => {
  const { error } = await supabase
    .from("discussion_state")
    .update({
      current_turn_index: turnIndex,
      current_round: round,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }
};

const resolveRules = (metadata: unknown): string[] => {
  const record = asObject(metadata);
  if (!record) {
    return [];
  }

  if (typeof record.rules === "string") {
    return record.rules
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  if (Array.isArray(record.rules)) {
    return record.rules
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const logsToEntries = (
  logs: DiscussionLog[],
  agentsById: Map<string, DiscussionAgent>,
): DiscussionEntry[] => {
  return logs.map((log) => {
    const agent = log.agent_id ? agentsById.get(log.agent_id) : null;
    const isManager = log.role === "manager";
    const speakerRole: "user" | "manager" | "expert" = 
      log.role === "user" ? "user" : isManager ? "manager" : "expert";

    return {
      id: log.id,
      type: "discussion_turn",
      speakerKey: log.role,
      speakerName: agent?.name ?? (log.role === "user" ? "User" : "Agent"),
      speakerRole,
      content: log.content,
      createdAt: log.created_at,
      agentTemplateId: log.agent_id,
      level: agent?.level ?? null,
      keywords: [],
    };
  });
};

const buildConversationHistory = (logs: DiscussionLog[], agentsById: Map<string, DiscussionAgent>, limit: number = 10) => {
  return logs
    .slice(-limit)
    .map((log) => {
      const agent = log.agent_id ? agentsById.get(log.agent_id) : null;
      const name = agent?.name ?? (log.role === "user" ? "User" : "Agent");
      return `[${name}]: ${log.content}`;
    })
    .join("\n");
};

export const getDiscussionState = async (projectId: string): Promise<DiscussionStateResponse> => {
  const supabase = createSupabaseAdmin();
  const project = await loadProject(supabase, projectId);
  const participants = await loadParticipants(supabase, projectId);
  const state = await loadOrCreateDiscussionState(supabase, projectId);
  const logs = await loadDiscussionLogs(supabase, projectId);

  // Load all agents (filter out user participants which have null agent_id)
  const agentIds = new Set(
    participants
      .map((p) => p.agent_id)
      .filter((id): id is string => id !== null)
  );
  const agentsById = new Map<string, DiscussionAgent>();
  
  for (const agentId of agentIds) {
    try {
      const agent = await loadAgentById(supabase, agentId);
      agentsById.set(agentId, agent);
    } catch (err) {
      console.error(`Failed to load agent ${agentId}:`, err);
    }
  }

  const entries = logsToEntries(logs, agentsById);

  // Build counts
  const counts: Record<string, number> = {};
  for (const log of logs) {
    const key = log.role;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // Determine next speaker
  let nextSpeaker: string | null = null;
  if (state.is_active && state.current_turn_index < participants.length) {
    const nextParticipant = participants[state.current_turn_index];
    nextSpeaker = nextParticipant?.role ?? null;
  }

  const speakerOrder = participants.map((p) => p.role);

  return {
    project,
    entries,
    counts,
    speakerOrder,
    nextSpeaker,
  };
};

export const advanceDiscussion = async (
  input: AdvanceDiscussionInput,
): Promise<DiscussionStateResponse> => {
  const supabase = createSupabaseAdmin();
  const project = await loadProject(supabase, input.projectId);

  if (project.type !== "discussion") {
    throw new Error("Projekt ist kein Diskussionstyp.");
  }

  const participants = await loadParticipants(supabase, input.projectId);
  if (participants.length === 0) {
    throw new Error("No participants found for this discussion.");
  }

  const state = await loadOrCreateDiscussionState(supabase, input.projectId);
  if (!state.is_active) {
    throw new Error("Discussion is already completed.");
  }

  const rules = resolveRules(project.metadata);

  // Load all agents (filter out user participants which have null agent_id)
  const agentIds = new Set(
    participants
      .map((p) => p.agent_id)
      .filter((id): id is string => id !== null)
  );
  const agentsById = new Map<string, DiscussionAgent>();
  
  for (const agentId of agentIds) {
    try {
      const agent = await loadAgentById(supabase, agentId);
      agentsById.set(agentId, agent);
    } catch (err) {
      console.error(`Failed to load agent ${agentId}:`, err);
    }
  }

  // 1. Save user message
  const userContent = input.message.trim();
  await saveDiscussionLog({
    supabase,
    projectId: input.projectId,
    agentId: null,
    role: "user",
    content: userContent,
    turnIndex: state.current_turn_index,
    roundNumber: state.current_round,
  });

  // 2. Increment turn index
  let nextTurnIndex = state.current_turn_index + 1;
  let nextRound = state.current_round;

  // If we've gone through all participants, increment round
  if (nextTurnIndex >= participants.length) {
    nextTurnIndex = 0;
    nextRound += 1;
  }

  // 3. Process AI agents turn by turn until we reach user again or complete
  let iterations = 0;

  while (iterations < MAX_TURN_ITERATIONS) {
    iterations += 1;

    // Check if we're back to user's turn or completed
    const currentParticipant = participants[nextTurnIndex];
    if (!currentParticipant) {
      break;
    }

    // If we've reached user again, stop
    if (currentParticipant.role === "user") {
      break;
    }

    // Check if we've exceeded max rounds
    if (nextRound > MAX_DISCUSSION_ROUNDS) {
      await updateDiscussionState({
        supabase,
        projectId: input.projectId,
        turnIndex: 0,
        round: nextRound,
        isActive: false,
      });
      break;
    }

    // Get the agent for this turn
    const agent = currentParticipant.agent_id ? agentsById.get(currentParticipant.agent_id) : null;
    if (!agent) {
      // Skip if agent not found
      nextTurnIndex += 1;
      if (nextTurnIndex >= participants.length) {
        nextTurnIndex = 0;
        nextRound += 1;
      }
      continue;
    }

    // Generate agent response
    const allLogs = await loadDiscussionLogs(supabase, input.projectId);
    const conversationHistory = buildConversationHistory(allLogs, agentsById);

    const agentResponse = await generateAgentResponse({
      agent,
      conversationHistory,
      rules,
    });

    // Save agent response
    await saveDiscussionLog({
      supabase,
      projectId: input.projectId,
      agentId: agent.id,
      role: currentParticipant.role,
      content: agentResponse,
      turnIndex: nextTurnIndex,
      roundNumber: nextRound,
    });

    // Increment turn index
    nextTurnIndex += 1;
    if (nextTurnIndex >= participants.length) {
      nextTurnIndex = 0;
      nextRound += 1;
    }
  }

  // Update discussion state
  let finalIsActive = true;
  if (nextRound > MAX_DISCUSSION_ROUNDS) {
    finalIsActive = false;
  }

  await updateDiscussionState({
    supabase,
    projectId: input.projectId,
    turnIndex: nextTurnIndex,
    round: nextRound,
    isActive: finalIsActive,
  });

  // Return updated state
  return getDiscussionState(input.projectId);
};

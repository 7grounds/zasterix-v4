/**
 * @MODULE_ID app.api.manager-discussion
 * @STAGE discussion
 * @DATA_INPUTS ["message", "history", "userId", "organizationId", "phase"]
 * @REQUIRED_TOOLS ["supabase-js", "groq"]
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  speaker?: string;
};

type DiscussionConfig = {
  agents: string[];
  linesPerAgent: number;
  rounds: number;
  topic: string;
};

type RequestBody = {
  message: string;
  history?: Message[];
  userId?: string;
  organizationId?: string;
  phase?: "initiation" | "confirmation" | "discussion" | "summary";
  discussionConfig?: DiscussionConfig;
  currentRound?: number;
  currentAgentIndex?: number;
  projectId?: string;
};

// Detect if message contains discussion/meeting keywords
function isDiscussionRequest(message: string): boolean {
  const keywords = ["discussion", "diskussion", "meeting", "besprechung", "sitzung", "runde"];
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword));
}

// Call AI agent
async function callAgent(
  agentName: string,
  systemPrompt: string,
  userMessage: string,
  history: Message[],
  modelName?: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-8).map(msg => ({
      role: msg.role === "assistant" ? "assistant" as const : "user" as const,
      content: msg.content
    })),
    { role: "user" as const, content: userMessage }
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName || "llama-3.1-8b-instant",
      messages,
      temperature: 0.2,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Get agent from database
async function getAgent(agentName: string, organizationId?: string) {
  let query = supabase
    .from("agent_templates")
    .select("id, name, system_prompt, ai_model_config")
    .eq("name", agentName);

  if (organizationId) {
    query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
  }

  const { data, error } = await query.maybeSingle();
  
  if (error || !data) {
    return null;
  }

  return data;
}

// Save to discussion logs
async function saveToDiscussionLog(
  projectId: string,
  agentId: string | null,
  speakerName: string,
  content: string
) {
  await supabase.from("discussion_logs").insert({
    project_id: projectId,
    agent_id: agentId,
    speaker_name: speakerName,
    content: content,
    created_at: new Date().toISOString()
  });
}

// Save to universal history
async function saveToUniversalHistory(
  userId: string,
  organizationId: string | null,
  projectId: string,
  payload: Record<string, unknown>
) {
  await supabase.from("universal_history").insert({
    user_id: userId,
    organization_id: organizationId,
    payload: {
      ...payload,
      project_id: projectId,
      timestamp: new Date().toISOString()
    },
    created_at: new Date().toISOString()
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as RequestBody;
    const {
      message,
      history = [],
      userId,
      organizationId,
      phase = "initiation",
      discussionConfig,
      currentRound = 0,
      currentAgentIndex = 0,
      projectId
    } = body;

    // Phase 1: User initiates discussion with Manager Alpha
    if (phase === "initiation" && isDiscussionRequest(message)) {
      const managerAlpha = await getAgent("Manager Alpha", organizationId);
      if (!managerAlpha) {
        return NextResponse.json({
          error: "Manager Alpha agent not found"
        }, { status: 404 });
      }

      // Manager Alpha recognizes discussion request and hands over
      const managerResponse = await callAgent(
        "Manager Alpha",
        managerAlpha.system_prompt,
        message,
        history
      );

      // Now call Discussion Leader to propose config
      const discussionLeader = await getAgent("Discussion Leader", organizationId);
      if (!discussionLeader) {
        return NextResponse.json({
          error: "Discussion Leader agent not found"
        }, { status: 404 });
      }

      const leaderPrompt = `Der Nutzer möchte eine Diskussion über: "${message}". 
Analysiere das Thema und schlage vor:
1. Welche Agenten sollten teilnehmen (aus: Manager L3, Hotel Expert L2, Guide Expert L2, Tourismus Expert L2, Experience Curator BO, Hotel-Hub-Integrator)?
2. Bestätige: 3 Zeilen pro Agent, 3 Runden
3. Frage nach Bestätigung

Format deine Antwort so:
VORSCHLAG:
Thema: [kurze Beschreibung]
Agenten: [Agent 1], [Agent 2], [Agent 3]
Regeln: 3 Zeilen pro Beitrag, 3 Runden
Teilnehmer: Agenten + Du selbst

Bist du einverstanden? (Antworte mit 'ja' oder 'bestätigt' zum Starten)`;

      const leaderResponse = await callAgent(
        "Discussion Leader",
        discussionLeader.system_prompt,
        leaderPrompt,
        []
      );

      // Parse the leader's response to extract agents
      const agentMatches = leaderResponse.match(/Agenten:\s*([^\n]+)/i);
      let suggestedAgents = ["Manager L3", "Hotel Expert L2", "Guide Expert L2"];
      
      if (agentMatches && agentMatches[1]) {
        const agentsList = agentMatches[1].split(',').map(a => a.trim());
        if (agentsList.length > 0) {
          suggestedAgents = agentsList;
        }
      }

      // Extract topic
      const topicMatch = leaderResponse.match(/Thema:\s*([^\n]+)/i);
      const extractedTopic = topicMatch && topicMatch[1] ? topicMatch[1].trim() : message.substring(0, 100);

      // Create discussionConfig to send back
      const proposedConfig: DiscussionConfig = {
        agents: suggestedAgents,
        linesPerAgent: 3,
        rounds: 3,
        topic: extractedTopic
      };

      return NextResponse.json({
        phase: "confirmation",
        managerResponse,
        leaderResponse,
        speaker: "Discussion Leader",
        needsConfirmation: true,
        discussionConfig: proposedConfig
      });
    }

    // Phase 2: User confirms configuration
    if (phase === "confirmation" && discussionConfig) {
      const { agents, rounds, topic } = discussionConfig;

      // Create or get project
      let activeProjectId = projectId;
      if (!activeProjectId) {
        const { data: newProject, error: projectError } = await supabase
          .from("projects")
          .insert({
            organization_id: organizationId || null,
            name: `Diskussion: ${topic.substring(0, 50)}`,
            type: "discussion",
            status: "active",
            metadata: {
              rules: [
                "Jeder Beitrag maximal 3 Zeilen",
                `${rounds} Runden insgesamt`,
                "Nutzer kann nach jedem Agenten kommentieren"
              ],
              speaker_order: [...agents, "user"],
              agents,
              rounds,
              topic
            },
            current_discussion_step: 0
          })
          .select("id")
          .single();

        if (projectError || !newProject) {
          throw new Error("Could not create project");
        }
        activeProjectId = newProject.id;
      }

      // Ensure activeProjectId is defined
      if (!activeProjectId) {
        throw new Error("Project ID is required to start discussion");
      }

      // Start discussion - Manager L3 opens
      const managerL3 = await getAgent("Manager L3", organizationId);
      if (!managerL3) {
        return NextResponse.json({
          error: "Manager L3 not found"
        }, { status: 404 });
      }

      const openingMessage = await callAgent(
        "Manager L3",
        managerL3.system_prompt,
        `Eröffne die Diskussion zum Thema: ${topic}. Stelle kurz das Thema vor und die Diskussionsregeln (3 Zeilen pro Person, 3 Runden). Maximal 3 Zeilen.`,
        []
      );

      if (userId) {
        await saveToDiscussionLog(activeProjectId, managerL3.id, "Manager L3", openingMessage);
        await saveToUniversalHistory(userId, organizationId || null, activeProjectId, {
          type: "discussion_start",
          speaker: "Manager L3",
          content: openingMessage,
          round: 1
        });
      }

      return NextResponse.json({
        phase: "discussion",
        projectId: activeProjectId,
        response: openingMessage,
        speaker: "Manager L3",
        currentRound: 1,
        currentAgentIndex: 1,
        discussionConfig,
        nextSpeaker: agents[1] || "user"
      });
    }

    // Phase 3: Discussion in progress
    if (phase === "discussion" && discussionConfig && projectId) {
      const { agents, rounds } = discussionConfig;
      
      // User's message
      if (userId && message.trim()) {
        await saveToDiscussionLog(projectId, null, "User", message);
        await saveToUniversalHistory(userId, organizationId || null, projectId, {
          type: "discussion_turn",
          speaker: "User",
          content: message,
          round: currentRound
        });
      }

      // Check if we need to move to next round or finish
      if (currentRound >= rounds && currentAgentIndex >= agents.length) {
        // Discussion complete - generate summary
        return NextResponse.json({
          phase: "summary",
          projectId,
          message: "Diskussion abgeschlossen. Zusammenfassung wird erstellt..."
        });
      }

      // Get next agent
      let nextIndex = currentAgentIndex;
      let nextRoundNum = currentRound;

      if (nextIndex >= agents.length) {
        nextIndex = 0;
        nextRoundNum += 1;
      }

      if (nextRoundNum > rounds) {
        return NextResponse.json({
          phase: "summary",
          projectId,
          message: "Alle Runden abgeschlossen."
        });
      }

      const nextAgentName = agents[nextIndex];
      const nextAgent = await getAgent(nextAgentName, organizationId);
      
      if (!nextAgent) {
        return NextResponse.json({
          error: `Agent ${nextAgentName} not found`
        }, { status: 404 });
      }

      // Get discussion history for context
      const { data: recentLogs } = await supabase
        .from("discussion_logs")
        .select("speaker_name, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(5);

      const contextHistory: Message[] = (recentLogs || []).reverse().map(log => ({
        role: log.speaker_name === "User" ? "user" as const : "assistant" as const,
        content: `[${log.speaker_name}]: ${log.content}`
      }));

      const agentResponse = await callAgent(
        nextAgentName,
        nextAgent.system_prompt,
        `Runde ${nextRoundNum}/${rounds}: Gib deinen Beitrag zur Diskussion. Maximal 3 Zeilen. Fokus auf deine Expertise.`,
        contextHistory
      );

      await saveToDiscussionLog(projectId, nextAgent.id, nextAgentName, agentResponse);
      if (userId) {
        await saveToUniversalHistory(userId, organizationId || null, projectId, {
          type: "discussion_turn",
          speaker: nextAgentName,
          content: agentResponse,
          round: nextRoundNum
        });
      }

      return NextResponse.json({
        phase: "discussion",
        projectId,
        response: agentResponse,
        speaker: nextAgentName,
        currentRound: nextRoundNum,
        currentAgentIndex: nextIndex + 1,
        discussionConfig,
        nextSpeaker: "user",
        roundComplete: nextIndex + 1 >= agents.length
      });
    }

    // Phase 4: Generate summary
    if (phase === "summary" && projectId) {
      // Get all discussion logs
      const { data: allLogs } = await supabase
        .from("discussion_logs")
        .select("speaker_name, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const discussionHistory = (allLogs || []).map(log => 
        `${log.speaker_name}: ${log.content}`
      ).join("\n\n");

      const managerL3 = await getAgent("Manager L3", organizationId);
      if (!managerL3) {
        return NextResponse.json({
          error: "Manager L3 not found for summary"
        }, { status: 404 });
      }

      const summary = await callAgent(
        "Manager L3",
        managerL3.system_prompt,
        `Erstelle eine kurze Zusammenfassung (maximal 5 Zeilen) der folgenden Diskussion:\n\n${discussionHistory}\n\nZusammenfassung mit Hauptpunkten und Entscheidungen:`,
        []
      );

      // Get existing metadata
      const { data: existingProject } = await supabase
        .from("projects")
        .select("metadata")
        .eq("id", projectId)
        .single();

      const existingMetadata = existingProject?.metadata || {};

      // Update project with summary, preserving existing metadata
      await supabase
        .from("projects")
        .update({
          status: "completed",
          metadata: {
            ...existingMetadata,
            summary,
            completed_at: new Date().toISOString()
          }
        })
        .eq("id", projectId);

      if (userId) {
        await saveToDiscussionLog(projectId, managerL3.id, "Manager L3 (Summary)", summary);
        await saveToUniversalHistory(userId, organizationId || null, projectId, {
          type: "discussion_summary",
          speaker: "Manager L3",
          content: summary
        });
      }

      return NextResponse.json({
        phase: "complete",
        projectId,
        summary,
        speaker: "Manager L3",
        message: "Diskussion abgeschlossen und Zusammenfassung gespeichert."
      });
    }

    // Default: just route to Manager Alpha
    const managerAlpha = await getAgent("Manager Alpha", organizationId);
    if (!managerAlpha) {
      return NextResponse.json({
        error: "Manager Alpha not found"
      }, { status: 404 });
    }

    const response = await callAgent(
      "Manager Alpha",
      managerAlpha.system_prompt,
      message,
      history
    );

    return NextResponse.json({
      phase: "normal",
      response,
      speaker: "Manager Alpha"
    });

  } catch (error) {
    console.error("Manager discussion error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error"
    }, { status: 500 });
  }
}

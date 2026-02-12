/**
 * @MODULE_ID app.chat.interface
 * @STAGE admin
 * @DATA_INPUTS ["agent", "chat_input", "course_roadmap", "logic_template", "ai_model_config", "stream_chunks"]
 * @REQUIRED_TOOLS ["app.api.chat", "supabase-js"]
 */
"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";

type AgentRecord = {
  id: string;
  name: string;
  level: number;
  category: string;
  parentTemplateId?: string | null;
  parent_template_id?: string | null;
  systemPrompt: string;
  system_prompt: string;
  logicTemplate?: string;
  logic_template?: string;
  finalSystemPrompt?: string;
  final_system_prompt?: string;
  aiModelConfig?: AiModelConfig | null;
  ai_model_config?: AiModelConfig | null;
  courseRoadmap: CourseStep[];
  course_roadmap: CourseStep[];
};

type AiModelConfig = {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type CourseStep = {
  id: number | string;
  title: string;
  status: string;
  type?: string;
  content?: string | null;
};

type ChatPayload = {
  text?: string;
  error?: string;
  roadmap?: CourseStep[] | null;
  completedStepIds?: number[];
};

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toCourseRoadmap = (value: unknown): CourseStep[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const id = record.id;
      const title = record.title;
      const status = record.status;
      const stepType = record.type;
      const content = record.content;
      if (
        (typeof id !== "number" && typeof id !== "string") ||
        typeof title !== "string" ||
        typeof status !== "string"
      ) {
        return null;
      }
      const nextStep: CourseStep = {
        id,
        title,
        status,
        content: typeof content === "string" ? content : null,
      };
      if (typeof stepType === "string" && stepType.trim().length > 0) {
        nextStep.type = stepType;
      }
      return nextStep;
    })
    .filter((step): step is CourseStep => Boolean(step));
};

const applyCompletedStepIds = (
  roadmap: CourseStep[],
  completedStepIds: number[],
): CourseStep[] => {
  if (completedStepIds.length === 0 || roadmap.length === 0) {
    return roadmap;
  }

  return roadmap.map((step) => {
    const stepId = typeof step.id === "number" ? step.id : Number.parseInt(step.id, 10);
    if (Number.isFinite(stepId) && completedStepIds.includes(stepId)) {
      return { ...step, status: "completed" };
    }
    return step;
  });
};

const isStartIntent = (value: string) =>
  /(start|starten|ich warte|weiter|go|los|beginnen|beginne)/i.test(value);

const resolveTeachingStep = (roadmap: CourseStep[]): CourseStep => {
  if (roadmap.length === 0) {
    return {
      id: 1,
      title: "Einfuehrung",
      status: "pending",
      type: "lesson",
      content: null,
    };
  }

  const firstPending =
    roadmap.find((step) => step.status !== "completed") ?? roadmap[0];
  const normalizedId =
    typeof firstPending.id === "number"
      ? firstPending.id
      : Number.parseInt(firstPending.id, 10);

  return {
    ...firstPending,
    id: Number.isFinite(normalizedId) ? normalizedId : 1,
    title: firstPending.title || "Einfuehrung",
  };
};

const normalizeAgentUpdate = (
  previous: AgentRecord,
  payload: Record<string, unknown>,
): AgentRecord => {
  const hasRoadmapField = Object.prototype.hasOwnProperty.call(
    payload,
    "course_roadmap",
  );
  const hasPromptField = Object.prototype.hasOwnProperty.call(
    payload,
    "system_prompt",
  );
  const hasNameField = Object.prototype.hasOwnProperty.call(payload, "name");
  const hasCategoryField = Object.prototype.hasOwnProperty.call(payload, "category");
  const hasModelConfigField = Object.prototype.hasOwnProperty.call(
    payload,
    "ai_model_config",
  );
  const hasFinalPromptField = Object.prototype.hasOwnProperty.call(
    payload,
    "final_system_prompt",
  );

  const nextRoadmap = hasRoadmapField
    ? toCourseRoadmap(payload.course_roadmap)
    : previous.course_roadmap;
  const nextPrompt =
    hasPromptField && typeof payload.system_prompt === "string"
      ? payload.system_prompt
      : previous.system_prompt;
  const nextFinalPrompt =
    hasFinalPromptField && typeof payload.final_system_prompt === "string"
      ? payload.final_system_prompt
      : previous.final_system_prompt ?? previous.finalSystemPrompt ?? nextPrompt;
  const nextModelConfig =
    hasModelConfigField &&
    payload.ai_model_config &&
    typeof payload.ai_model_config === "object" &&
    !Array.isArray(payload.ai_model_config)
      ? (payload.ai_model_config as AiModelConfig)
      : previous.ai_model_config ?? previous.aiModelConfig ?? null;

  return {
    ...previous,
    name:
      hasNameField && typeof payload.name === "string"
        ? payload.name
        : previous.name,
    category:
      hasCategoryField && typeof payload.category === "string"
        ? payload.category
        : previous.category,
    systemPrompt: nextPrompt,
    system_prompt: nextPrompt,
    finalSystemPrompt: nextFinalPrompt,
    final_system_prompt: nextFinalPrompt,
    aiModelConfig: nextModelConfig,
    ai_model_config: nextModelConfig,
    courseRoadmap: nextRoadmap,
    course_roadmap: nextRoadmap,
  };
};

export default function ChatInterface({
  agent: initialAgent,
}: {
  agent: AgentRecord;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [agent, setAgent] = useState<AgentRecord>(initialAgent);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-assistant",
      role: "assistant",
      content: `Ich bin dein ${initialAgent.name}. Wie kann ich dir heute helfen?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingForFirstChunk, setWaitingForFirstChunk] = useState(false);
  const [resettingRoadmap, setResettingRoadmap] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    return createClient(url, anonKey);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`roadmap_updates_${agent.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agent_templates",
          filter: `id=eq.${agent.id}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          setAgent((prev) => normalizeAgentUpdate(prev, next));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [agent.id, supabase]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    const resolveUserContext = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!isMounted) return;
      const resolvedUserId = authData.user?.id ?? null;
      setUserId(resolvedUserId);

      if (!resolvedUserId) {
        setOrganizationId(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", resolvedUserId)
        .maybeSingle();

      if (!isMounted) return;
      setOrganizationId(profile?.organization_id ?? null);
    };

    void resolveUserContext();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const activeRoadmap = useMemo(
    () =>
      agent.course_roadmap.length > 0 ? agent.course_roadmap : agent.courseRoadmap,
    [agent.courseRoadmap, agent.course_roadmap],
  );

  useEffect(() => {
    scrollToBottom("auto");
  }, []);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages]);

  const resetRoadmap = async () => {
    if (!supabase || resettingRoadmap) return;

    setResettingRoadmap(true);
    const { error } = await supabase
      .from("agent_templates")
      .update({ course_roadmap: null })
      .eq("id", agent.id);

    if (error) {
      console.error("Roadmap reset error:", error);
    } else {
      setAgent((previous) => ({
        ...previous,
        courseRoadmap: [],
        course_roadmap: [],
      }));
    }

    setResettingRoadmap(false);
  };

  const applyRoadmapMeta = (roadmapValue: unknown, completedIdsValue: unknown) => {
    const roadmap = toCourseRoadmap(roadmapValue);
    if (roadmap.length > 0) {
      setAgent((previous) => ({
        ...previous,
        courseRoadmap: roadmap,
        course_roadmap: roadmap,
      }));
      return;
    }

    const completedStepIds = Array.isArray(completedIdsValue)
      ? completedIdsValue
          .map((value) =>
            typeof value === "number" ? value : Number.parseInt(String(value), 10),
          )
          .filter((value) => Number.isFinite(value))
      : [];

    if (completedStepIds.length > 0) {
      setAgent((previous) => {
        const baseRoadmap =
          previous.course_roadmap.length > 0
            ? previous.course_roadmap
            : previous.courseRoadmap;
        const updatedRoadmap = applyCompletedStepIds(baseRoadmap, completedStepIds);
        return {
          ...previous,
          courseRoadmap: updatedRoadmap,
          course_roadmap: updatedRoadmap,
        };
      });
    }
  };

  const persistModuleCompletion = async (moduleId: number | string) => {
    if (!supabase || !userId) {
      return;
    }

    const normalizedModuleId =
      typeof moduleId === "number" ? moduleId : Number.parseInt(String(moduleId), 10);
    const safeModuleId = Number.isFinite(normalizedModuleId)
      ? normalizedModuleId
      : String(moduleId);
    const progressStageId = "zasterix-teacher";
    const progressModuleId = `${agent.id}-module-${safeModuleId}`;
    const completedTaskId = `lesson-${safeModuleId}-completed`;

    const { data: existingProgress } = await supabase
      .from("user_progress")
      .select("completed_tasks")
      .eq("user_id", userId)
      .eq("stage_id", progressStageId)
      .eq("module_id", progressModuleId)
      .maybeSingle();

    const existingTasks = existingProgress?.completed_tasks ?? [];
    const completedTasks = Array.from(new Set([...existingTasks, completedTaskId]));

    const { error: progressError } = await supabase.from("user_progress").upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        stage_id: progressStageId,
        module_id: progressModuleId,
        completed_tasks: completedTasks,
        is_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,stage_id,module_id" },
    );

    if (progressError) {
      console.error("user_progress update error:", progressError);
    }
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, userMessage];
    const hasRoadmap = activeRoadmap.length > 0;
    const shouldAutoStartModule = hasRoadmap && isStartIntent(trimmed);
    const targetStep = resolveTeachingStep(activeRoadmap);
    const targetStepType = targetStep.type || "lesson";
    const targetStepNeedsContent =
      !targetStep.content || targetStep.content.trim().length === 0;
    const messageForAi = shouldAutoStartModule
      ? `Startsignal bestaetigt. Starte jetzt direkt mit Modul ${targetStep.id} (${targetStep.title}) und liefere den vollen Lerninhalt ohne Rueckfrage.`
      : trimmed;
    const discipline = agent.category || "General";
    const hiddenInstruction = shouldAutoStartModule
      ? targetStepNeedsContent
        ? `Generiere basierend auf deiner discipline und dem step.title einen ausfuehrlichen Lerninhalt (mind. 300 Woerter) fuer den Typ ${targetStepType}. discipline=${discipline}; step.title=${targetStep.title}.`
        : `Nutze den bereits vorhandenen Step-Content fuer ${targetStep.title} als Unterrichtsbasis und liefere eine zusammenhaengende, fachspezifische Lektion fuer ${discipline}.`
      : null;
    const autoFillStep = shouldAutoStartModule
      ? {
          id: targetStep.id,
          title: targetStep.title,
          type: targetStepType,
          discipline,
        }
      : null;
    const historyForApi = nextMessages.map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));
    if (shouldAutoStartModule && historyForApi.length > 0) {
      historyForApi[historyForApi.length - 1] = {
        role: "user",
        content: messageForAi,
      };
    }
    const resolvedSystemPrompt =
      agent.final_system_prompt ||
      agent.finalSystemPrompt ||
      agent.system_prompt ||
      agent.systemPrompt;
    const resolvedModelConfig =
      agent.ai_model_config ?? agent.aiModelConfig ?? null;
    const assistantMessageId = createId();
    const updateAssistantMessage = (content: string) => {
      setMessages((previous) =>
        previous.map((entry) =>
          entry.id === assistantMessageId ? { ...entry, content } : entry,
        ),
      );
    };

    setMessages([
      ...nextMessages,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      },
    ]);
    setInput("");
    setLoading(true);
    setWaitingForFirstChunk(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageForAi,
          agentId: agent.id,
          systemPrompt: resolvedSystemPrompt,
          agentName: agent.name,
          aiModelConfig: resolvedModelConfig,
          history: historyForApi,
          hiddenInstruction,
          stream: true,
          autoFillStep,
          roadmapSnapshot: activeRoadmap,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Chat request failed";
        try {
          const payload = (await response.json()) as ChatPayload;
          errorMessage = payload.error || errorMessage;
        } catch {
          // ignore json parse error for non-json responses
        }
        throw new Error(errorMessage);
      }

      let receivedFirstChunk = false;
      let assistantContent = "";

      const processStreamEventLine = (line: string) => {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const type = parsed.type;
        if (type !== "chunk" && type !== "meta" && type !== "done" && type !== "error" && type !== "final_text") {
          return;
        }

        if (type === "chunk") {
          const text = typeof parsed.text === "string" ? parsed.text : "";
          if (!text) {
            return;
          }
          assistantContent += text;
          if (!receivedFirstChunk) {
            receivedFirstChunk = true;
            setWaitingForFirstChunk(false);
          }
          updateAssistantMessage(assistantContent);
          return;
        }

        if (type === "final_text") {
          const finalText = typeof parsed.text === "string" ? parsed.text : "";
          assistantContent = finalText;
          if (!receivedFirstChunk && finalText.length > 0) {
            receivedFirstChunk = true;
            setWaitingForFirstChunk(false);
          }
          updateAssistantMessage(finalText || "Keine Antwort erhalten.");
          return;
        }

        if (type === "meta") {
          applyRoadmapMeta(parsed.roadmap, parsed.completedStepIds);
          return;
        }

        if (type === "error") {
          const message =
            typeof parsed.message === "string" && parsed.message.length > 0
              ? parsed.message
              : "Kommunikationsfehler mit dem Agenten.";
          throw new Error(message);
        }
      };

      if (!response.body) {
        const payload = (await response.json()) as ChatPayload;
        applyRoadmapMeta(payload.roadmap, payload.completedStepIds);
        const fallbackText = payload.text?.trim() || "Keine Antwort erhalten.";
        if (fallbackText.length > 0) {
          receivedFirstChunk = true;
          setWaitingForFirstChunk(false);
        }
        updateAssistantMessage(fallbackText);
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (line.length > 0) {
              processStreamEventLine(line);
            }
            newlineIndex = buffer.indexOf("\n");
          }
        }

        const trailing = buffer.trim();
        if (trailing.length > 0) {
          processStreamEventLine(trailing);
        }

        if (!assistantContent.trim()) {
          updateAssistantMessage("Keine Antwort erhalten.");
        }
      }

      if (shouldAutoStartModule) {
        await persistModuleCompletion(targetStep.id);
      }
    } catch (error: unknown) {
      updateAssistantMessage(
        error instanceof Error
          ? `Kommunikationsfehler: ${error.message}`
          : "Kommunikationsfehler mit dem Agenten.",
      );
    } finally {
      setWaitingForFirstChunk(false);
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
        }}
      />

      <div className="z-10 flex min-h-0 flex-1 flex-col">
        {activeRoadmap.length > 0 ? (
          <div className="mx-4 mt-4 flex-none rounded-xl border border-[#00a884]/30 bg-[#111b21] p-4 md:mx-8">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-shadow-glow text-[10px] font-black uppercase tracking-widest text-[#00a884]">
                Kurs-Roadmap
              </span>
              <button
                type="button"
                onClick={resetRoadmap}
                disabled={resettingRoadmap}
                className="rounded-md p-1 text-[#54656f] transition-colors hover:text-[#8696a0] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Roadmap zuruecksetzen"
                title="Roadmap zuruecksetzen"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M15.5 4h5v2h-2v3h-2V6h-2V4zM6 7h8l-1 13H7L6 7zm2-3h4l1 2H7l1-2z" />
                </svg>
              </button>
            </div>
            <div className="flex gap-1.5">
              {activeRoadmap.map((step) => (
                <div
                  key={String(step.id)}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#202c33]"
                >
                  <div
                    className={`h-full transition-all duration-1000 ${
                      step.status === "completed" ? "bg-[#00a884]" : "bg-[#2a3942]"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div
          ref={containerRef}
          className="scrollbar-thin scrollbar-thumb-[#374045] flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-28 pt-6 md:px-8"
          style={{ paddingBottom: "max(7rem, env(safe-area-inset-bottom) + 5rem)" }}
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                message.role === "assistant"
                  ? "self-start rounded-tl-none border border-[#222d34] bg-[#202c33]"
                  : "self-end rounded-tr-none bg-[#056162]"
              }`}
            >
              <div className="break-words [overflow-wrap:anywhere] [&_a]:break-all [&_code]:break-words [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[#0f1a20] [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && waitingForFirstChunk ? (
            <div className="self-start rounded-2xl rounded-tl-none border border-[#222d34] bg-[#202c33] px-3 py-2">
              <div className="flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8696a0]"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8696a0]"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8696a0]"
                  style={{ animationDelay: "240ms" }}
                />
              </div>
            </div>
          ) : null}
          <div ref={messagesEndRef} className="h-0" />
        </div>
      </div>

      <footer className="z-10 flex-none border-t border-[#222d34] bg-[#202c33] p-6">
        <form
          className="flex items-center gap-4 rounded-xl border border-[#2a3942] bg-[#2a3942] px-4 py-2 transition-all focus-within:border-[#00a884]/50"
          onSubmit={send}
          autoComplete="off"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Frage nach einem Kurs..."
            className="flex-1 border-none bg-transparent text-sm text-[#e9edef] outline-none placeholder-[#8696a0] focus:ring-0"
            disabled={loading}
          />
          <button
            type="submit"
            className="text-[#00a884] transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={loading || !input.trim()}
            aria-label="Senden"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
            </svg>
          </button>
        </form>
      </footer>
    </>
  );
}

/**
 * @MODULE_ID app.chat.interface
 * @STAGE admin
 * @DATA_INPUTS ["agent", "chat_input", "course_roadmap"]
 * @REQUIRED_TOOLS ["app.api.chat", "supabase-js"]
 */
"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type AgentRecord = {
  id: string;
  name: string;
  level: number;
  category: string;
  systemPrompt: string;
  system_prompt: string;
  courseRoadmap: CourseStep[];
  course_roadmap: CourseStep[];
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
      if (
        (typeof id !== "number" && typeof id !== "string") ||
        typeof title !== "string" ||
        typeof status !== "string"
      ) {
        return null;
      }
      return { id, title, status };
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

  const nextRoadmap = hasRoadmapField
    ? toCourseRoadmap(payload.course_roadmap)
    : previous.course_roadmap;
  const nextPrompt =
    hasPromptField && typeof payload.system_prompt === "string"
      ? payload.system_prompt
      : previous.system_prompt;

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
  const [resettingRoadmap, setResettingRoadmap] = useState(false);

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

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((previous) => [
      ...previous,
      {
        id: createId(),
        role: "user",
        content: trimmed,
      },
    ]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          agentId: agent.id,
          systemPrompt: agent.system_prompt || agent.systemPrompt,
          agentName: agent.name,
        }),
      });

      const payload = (await response.json()) as {
        text?: string;
        error?: string;
        roadmap?: CourseStep[] | null;
        completedStepIds?: number[];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Chat request failed");
      }

      if (Array.isArray(payload.roadmap) && payload.roadmap.length > 0) {
        setAgent((previous) => ({
          ...previous,
          courseRoadmap: payload.roadmap ?? [],
          course_roadmap: payload.roadmap ?? [],
        }));
      } else if (
        Array.isArray(payload.completedStepIds) &&
        payload.completedStepIds.length > 0
      ) {
        setAgent((previous) => {
          const baseRoadmap =
            previous.course_roadmap.length > 0
              ? previous.course_roadmap
              : previous.courseRoadmap;
          const updatedRoadmap = applyCompletedStepIds(
            baseRoadmap,
            payload.completedStepIds ?? [],
          );

          return {
            ...previous,
            courseRoadmap: updatedRoadmap,
            course_roadmap: updatedRoadmap,
          };
        });
      }

      setMessages((previous) => [
        ...previous,
        {
          id: createId(),
          role: "assistant",
          content: payload.text?.trim() || "Keine Antwort erhalten.",
        },
      ]);
    } catch (error: unknown) {
      setMessages((previous) => [
        ...previous,
        {
          id: createId(),
          role: "assistant",
          content:
            error instanceof Error
              ? `Kommunikationsfehler: ${error.message}`
              : "Kommunikationsfehler mit dem Agenten.",
        },
      ]);
    } finally {
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
          className="scrollbar-thin scrollbar-thumb-[#374045] flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8"
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
              {message.content}
            </div>
          ))}
          {loading ? (
            <div className="animate-pulse text-[10px] text-[#8696a0]">
              Zasterix verarbeitet Anfrage...
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

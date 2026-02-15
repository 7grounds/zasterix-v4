/**
 * @MODULE_ID app.manager-alpha.page
 * @STAGE discussion
 * @DATA_INPUTS ["user_input", "discussion_state"]
 * @REQUIRED_TOOLS ["app.api.manager-discussion"]
 */
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  speaker: string;
  timestamp: string;
};

type DiscussionConfig = {
  agents: string[];
  linesPerAgent: number;
  rounds: number;
  topic: string;
};

type DiscussionState = {
  phase: "normal" | "confirmation" | "discussion" | "summary" | "complete";
  projectId?: string;
  discussionConfig?: DiscussionConfig;
  currentRound?: number;
  currentAgentIndex?: number;
  nextSpeaker?: string;
  needsConfirmation?: boolean;
};

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function ManagerAlphaPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [discussionState, setDiscussionState] = useState<DiscussionState>({
    phase: "normal"
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    return createClient(url, anonKey);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;
    const resolveUserContext = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;

      const nextUserId = data.user?.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setOrganizationId(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", nextUserId)
        .maybeSingle();
      if (!isMounted) return;
      setOrganizationId(profile?.organization_id ?? null);
    };

    void resolveUserContext();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Initial welcome message
  useEffect(() => {
    setMessages([{
      id: createId(),
      role: "assistant",
      content: "Manager Alpha hier. Ich kann Projekte koordinieren und Diskussionen initiieren. Schreibe 'discussion' oder 'meeting' um eine strukturierte Multi-Agent Diskussion zu starten.",
      speaker: "Manager Alpha",
      timestamp: new Date().toISOString()
    }]);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    // Add user message
    const userMsg: Message = {
      id: createId(),
      role: "user",
      content: message,
      speaker: "You",
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Check if user is confirming discussion
      const isConfirming = discussionState.needsConfirmation && 
        (message.toLowerCase().includes("ja") || 
         message.toLowerCase().includes("bestätigt") ||
         message.toLowerCase().includes("yes") ||
         message.toLowerCase().includes("confirm"));

      let requestBody: Record<string, unknown> = {
        message,
        userId,
        organizationId,
        phase: discussionState.phase,
        history: messages.slice(-6).map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      };

      // Handle confirmation phase
      if (isConfirming && discussionState.needsConfirmation) {
        // Parse agents from last message
        const lastAssistantMsg = messages.filter(m => m.role === "assistant").pop();
        const agentMatches = lastAssistantMsg?.content.match(/Agenten:\s*([^\\n]+)/);
        const agentsText = agentMatches ? agentMatches[1] : "";
        const agents = agentsText.split(",").map(a => a.trim()).filter(Boolean);

        requestBody = {
          ...requestBody,
          phase: "confirmation",
          discussionConfig: {
            agents: agents.length > 0 ? agents : ["Manager L3", "Hotel Expert L2", "Tourismus Expert L2"],
            linesPerAgent: 3,
            rounds: 3,
            topic: message
          }
        };
      } else if (discussionState.phase === "discussion") {
        requestBody = {
          ...requestBody,
          phase: "discussion",
          projectId: discussionState.projectId,
          discussionConfig: discussionState.discussionConfig,
          currentRound: discussionState.currentRound,
          currentAgentIndex: discussionState.currentAgentIndex
        };
      } else if (discussionState.phase === "summary") {
        requestBody = {
          ...requestBody,
          phase: "summary",
          projectId: discussionState.projectId
        };
      }

      const response = await fetch("/api/manager-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      // Handle different phases
      if (data.phase === "confirmation") {
        // Manager hands off to Discussion Leader
        if (data.managerResponse) {
          setMessages(prev => [...prev, {
            id: createId(),
            role: "assistant",
            content: data.managerResponse,
            speaker: "Manager Alpha",
            timestamp: new Date().toISOString()
          }]);
        }
        
        setMessages(prev => [...prev, {
          id: createId(),
          role: "assistant",
          content: data.leaderResponse,
          speaker: data.speaker || "Discussion Leader",
          timestamp: new Date().toISOString()
        }]);

        setDiscussionState({
          phase: "confirmation",
          needsConfirmation: true
        });
      } else if (data.phase === "discussion") {
        setMessages(prev => [...prev, {
          id: createId(),
          role: "assistant",
          content: data.response,
          speaker: data.speaker,
          timestamp: new Date().toISOString()
        }]);

        setDiscussionState({
          phase: "discussion",
          projectId: data.projectId,
          discussionConfig: data.discussionConfig,
          currentRound: data.currentRound,
          currentAgentIndex: data.currentAgentIndex,
          nextSpeaker: data.nextSpeaker
        });

        // Auto-transition to summary if discussion is complete
        if (data.roundComplete && data.currentRound >= data.discussionConfig.rounds) {
          setTimeout(async () => {
            setLoading(true);
            try {
              const summaryResponse = await fetch("/api/manager-discussion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: "",
                  userId,
                  organizationId,
                  phase: "summary",
                  projectId: data.projectId
                })
              });
              const summaryData = await summaryResponse.json();
              
              if (summaryData.summary) {
                setMessages(prev => [...prev, {
                  id: createId(),
                  role: "assistant",
                  content: summaryData.summary,
                  speaker: "Manager L3 (Summary)",
                  timestamp: new Date().toISOString()
                }]);
              }

              setDiscussionState({ phase: "complete", projectId: data.projectId });
            } catch (error) {
              console.error("Summary error:", error);
            } finally {
              setLoading(false);
            }
          }, 1000);
        }
      } else if (data.phase === "summary" || data.phase === "complete") {
        if (data.summary) {
          setMessages(prev => [...prev, {
            id: createId(),
            role: "assistant",
            content: data.summary,
            speaker: "Manager L3 (Summary)",
            timestamp: new Date().toISOString()
          }]);
        }
        
        if (data.message) {
          setMessages(prev => [...prev, {
            id: createId(),
            role: "system",
            content: data.message,
            speaker: "System",
            timestamp: new Date().toISOString()
          }]);
        }

        setDiscussionState({ phase: "complete", projectId: data.projectId });
      } else {
        // Normal mode
        setMessages(prev => [...prev, {
          id: createId(),
          role: "assistant",
          content: data.response,
          speaker: data.speaker || "Manager Alpha",
          timestamp: new Date().toISOString()
        }]);

        setDiscussionState({ phase: "normal" });
      }

    } catch (error) {
      setMessages(prev => [...prev, {
        id: createId(),
        role: "system",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        speaker: "System",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString("de-CH", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "--:--";
    }
  };

  return (
    <div className="min-h-screen rounded-3xl border border-slate-800/70 bg-slate-950 p-6 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)] md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
            MAS Discussion System
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">
            Manager Alpha
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${
            loading ? "bg-yellow-400 animate-pulse" : 
            discussionState.phase === "discussion" ? "bg-green-400 animate-pulse" :
            "bg-emerald-400"
          }`} />
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {discussionState.phase === "discussion" 
              ? `Round ${discussionState.currentRound}/${discussionState.discussionConfig?.rounds || 3}`
              : discussionState.phase
            }
          </span>
        </div>
      </div>

      {discussionState.phase === "discussion" && discussionState.discussionConfig && (
        <div className="mb-4 rounded-2xl border border-emerald-800/80 bg-emerald-900/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-400">Active Discussion</p>
          <p className="mt-2 text-sm text-slate-300">
            <strong>Topic:</strong> {discussionState.discussionConfig.topic}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            <strong>Agents:</strong> {discussionState.discussionConfig.agents.join(", ")}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            <strong>Next:</strong> {discussionState.nextSpeaker || "You"}
          </p>
        </div>
      )}

      <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
        {messages.map((msg) => (
          <article
            key={msg.id}
            className={`rounded-xl border px-3 py-2 text-sm ${
              msg.role === "user"
                ? "border-[#056162]/60 bg-[#056162]/20"
                : msg.role === "system"
                ? "border-yellow-600/40 bg-yellow-900/20"
                : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <span className="font-semibold">{msg.speaker}</span>
              <span>{formatTime(msg.timestamp)}</span>
            </div>
            <p className="whitespace-pre-line text-slate-100">{msg.content}</p>
          </article>
        ))}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-400 animate-pulse">
              Processing...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="mt-4 flex gap-3" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            discussionState.needsConfirmation
              ? "Type 'ja' or 'bestätigt' to confirm..."
              : discussionState.phase === "discussion"
              ? "Your contribution to the discussion..."
              : "Message Manager Alpha..."
          }
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500/60"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-emerald-500 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>

      {discussionState.projectId && (
        <div className="mt-4 text-xs text-slate-500">
          Project ID: {discussionState.projectId}
        </div>
      )}
    </div>
  );
}

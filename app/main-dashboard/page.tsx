/**
 * @MODULE_ID app.main-dashboard
 * @STAGE global
 * @DATA_INPUTS ["user", "projects", "agent_templates", "discussion_logs"]
 * @REQUIRED_TOOLS ["supabase-js", "manager-alpha-api"]
 */
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  speaker: string;
  timestamp: string;
};

type DiscussionState = {
  phase: "normal" | "initiation" | "confirmation" | "discussion" | "summary" | "complete";
  projectId?: string;
  currentRound?: number;
  currentAgentIndex?: number;
  needsConfirmation?: boolean;
  discussionConfig?: {
    agents: string[];
    linesPerAgent: number;
    rounds: number;
    topic: string;
  };
};

type AgentTemplate = {
  id: string;
  name: string;
  level: number | null;
  category: string | null;
  description: string | null;
};

type Project = {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
};

type Meeting = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  metadata: {
    summary?: string;
  };
};

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function MainDashboardPage() {
  const [activeSection, setActiveSection] = useState<
    "chat" | "agents" | "projects" | "meetings"
  >("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Manager Alpha Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [discussionState, setDiscussionState] = useState<DiscussionState>({
    phase: "initiation",
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Data State
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Initialize Supabase and fetch user
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const initUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        // Try to get organization_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (profile) {
          setOrganizationId(profile.organization_id);
        }
      }
    };

    initUser();

    // Add welcome message
    setMessages([
      {
        id: createId(),
        role: "assistant",
        content:
          "Welcome to the Zasterix MAS Dashboard! I'm Manager Alpha. How can I help you today? You can start a discussion, ask about projects, or explore our agent capabilities.",
        speaker: "Manager Alpha",
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  // Load data when sections are viewed
  useEffect(() => {
    if (activeSection === "chat") return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const loadData = async () => {
      setLoadingData(true);

      if (activeSection === "agents" && agents.length === 0) {
        const { data } = await supabase
          .from("agent_templates")
          .select("id, name, level, category, description")
          .order("level", { ascending: false });

        if (data) setAgents(data);
      }

      if (activeSection === "projects" && projects.length === 0) {
        const { data } = await supabase
          .from("projects")
          .select("id, name, type, status, created_at")
          .order("created_at", { ascending: false })
          .limit(20);

        if (data) setProjects(data);
      }

      if (activeSection === "meetings" && meetings.length === 0) {
        const { data } = await supabase
          .from("projects")
          .select("id, name, status, created_at, metadata")
          .eq("type", "discussion")
          .order("created_at", { ascending: false })
          .limit(20);

        if (data) setMeetings(data as Meeting[]);
      }

      setLoadingData(false);
    };

    loadData();
  }, [activeSection, agents.length, projects.length, meetings.length]);

  // Auto-scroll chat
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: input.trim(),
      speaker: "You",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    
    // Check if this is a confirmation message
    const isConfirmation = /^(ja|yes|bestätigt|confirmed|ok)$/i.test(input.trim());
    let phaseToSend = discussionState.phase;
    
    if (isConfirmation && discussionState.phase === "confirmation" && discussionState.needsConfirmation) {
      // User is confirming, so we should move to discussion start
      phaseToSend = "confirmation"; // API expects "confirmation" to start discussion
    }
    
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/manager-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          userId: userId || "anonymous",
          organizationId: organizationId,
          phase: phaseToSend,
          discussionConfig: discussionState.discussionConfig,
          currentRound: discussionState.currentRound,
          currentAgentIndex: discussionState.currentAgentIndex,
          projectId: discussionState.projectId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "system",
            content: `Error: ${data.error}`,
            speaker: "System",
            timestamp: new Date().toISOString(),
          },
        ]);
      } else {
        // Add assistant message
        const assistantMessage: Message = {
          id: createId(),
          role: "assistant",
          content: data.response || data.leaderResponse || data.managerResponse || "No response received.",
          speaker: data.speaker || "Manager Alpha",
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Update discussion state from API response
        const newState: DiscussionState = {
          phase: data.phase || discussionState.phase,
          projectId: data.projectId || discussionState.projectId,
          currentRound: data.currentRound ?? discussionState.currentRound,
          currentAgentIndex: data.currentAgentIndex ?? discussionState.currentAgentIndex,
          needsConfirmation: data.needsConfirmation ?? discussionState.needsConfirmation,
          discussionConfig: data.discussionConfig || discussionState.discussionConfig,
        };

        setDiscussionState(newState);

        // If we're in discussion phase and there's a next speaker, automatically trigger next agent
        if (data.phase === "discussion" && data.nextSpeaker && data.nextSpeaker !== "user") {
          // Auto-trigger next agent after a short delay
          setTimeout(async () => {
            try {
              const nextResponse = await fetch("/api/manager-discussion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: "(continue discussion)",
                  userId: userId || "anonymous",
                  organizationId: organizationId,
                  phase: data.phase,
                  discussionConfig: data.discussionConfig,
                  currentRound: data.currentRound,
                  currentAgentIndex: data.currentAgentIndex,
                  projectId: data.projectId,
                }),
              });

              const nextData = await nextResponse.json();

              if (!nextData.error && nextData.response) {
                const nextMessage: Message = {
                  id: createId(),
                  role: "assistant",
                  content: nextData.response,
                  speaker: nextData.speaker || "Agent",
                  timestamp: new Date().toISOString(),
                };

                setMessages((prev) => [...prev, nextMessage]);

                // Update state again
                setDiscussionState({
                  phase: nextData.phase || data.phase,
                  projectId: nextData.projectId || data.projectId,
                  currentRound: nextData.currentRound ?? data.currentRound,
                  currentAgentIndex: nextData.currentAgentIndex ?? data.currentAgentIndex,
                  discussionConfig: nextData.discussionConfig || data.discussionConfig,
                });
              }
            } catch (error) {
              console.error("Failed to auto-trigger next agent:", error);
            }
          }, 1000);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "system",
          content: "Failed to connect to Manager Alpha. Please try again.",
          speaker: "System",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    {
      id: "chat",
      label: "💬 Manager Chat",
      icon: "💬",
      description: "Chat with Manager Alpha",
    },
    {
      id: "agents",
      label: "🤖 Agents",
      icon: "🤖",
      description: "View all agents",
    },
    {
      id: "projects",
      label: "📁 Projects",
      icon: "📁",
      description: "View all projects",
    },
    {
      id: "meetings",
      label: "📅 Meetings",
      icon: "📅",
      description: "View discussion meetings",
    },
  ];

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-20"
        } flex flex-col border-r border-slate-800 bg-slate-950 transition-all duration-300`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          {sidebarOpen && (
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-emerald-400">Zasterix</h1>
              <p className="text-xs text-slate-400">MAS Dashboard</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-emerald-400"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 p-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as typeof activeSection)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                activeSection === item.id
                  ? "bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              {sidebarOpen && (
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {item.label.split(" ")[1]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {item.description}
                  </span>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4">
          <Link
            href="/dashboard"
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-400 transition-all hover:bg-slate-800/50 hover:text-slate-200`}
          >
            <span className="text-2xl">🏠</span>
            {sidebarOpen && (
              <span className="text-sm font-semibold">Back to Dashboard</span>
            )}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              {activeSection === "chat" && "Manager Alpha Chat"}
              {activeSection === "agents" && "Agent Templates"}
              {activeSection === "projects" && "Projects"}
              {activeSection === "meetings" && "Discussion Meetings"}
            </h2>
            <p className="text-sm text-slate-400">
              {activeSection === "chat" &&
                "Start discussions and interact with Manager Alpha"}
              {activeSection === "agents" &&
                "View all available agent templates in the system"}
              {activeSection === "projects" && "All projects in the system"}
              {activeSection === "meetings" &&
                "Completed discussion meetings with summaries"}
            </p>
          </div>
          {discussionState.phase !== "normal" &&
            discussionState.phase !== "complete" &&
            activeSection === "chat" && (
              <div className="rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-400">
                Discussion: Round {discussionState.currentRound || 1}
              </div>
            )}
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {/* Chat Section */}
          {activeSection === "chat" && (
            <div className="flex h-full flex-col">
              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl px-6 py-4 ${
                        msg.role === "user"
                          ? "bg-teal-600 text-white"
                          : msg.role === "system"
                            ? "bg-slate-700 text-slate-200"
                            : "bg-emerald-500/20 text-slate-100"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                          {msg.speaker}
                        </span>
                        <span className="text-xs opacity-60">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-2xl rounded-2xl bg-slate-800 px-6 py-4 text-slate-400">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"></div>
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="mt-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message to Manager Alpha..."
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="rounded-2xl bg-emerald-500 px-8 py-4 font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Agents Section */}
          {activeSection === "agents" && (
            <div className="space-y-4">
              {loadingData ? (
                <div className="text-center text-slate-400">
                  Loading agents...
                </div>
              ) : agents.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
                  No agents found in the system.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-400/40"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-100">
                            {agent.name}
                          </h3>
                          <p className="text-xs uppercase tracking-wider text-emerald-400">
                            Level {agent.level || "N/A"}
                          </p>
                        </div>
                        {agent.category && (
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                            {agent.category}
                          </span>
                        )}
                      </div>
                      {agent.description && (
                        <p className="text-sm text-slate-400">
                          {agent.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Projects Section */}
          {activeSection === "projects" && (
            <div className="space-y-4">
              {loadingData ? (
                <div className="text-center text-slate-400">
                  Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
                  No projects found.
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-400/40"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-100">
                            {project.name}
                          </h3>
                          <div className="mt-2 flex gap-3 text-xs text-slate-400">
                            <span>Type: {project.type}</span>
                            <span>•</span>
                            <span>Status: {project.status}</span>
                            <span>•</span>
                            <span>
                              {new Date(project.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            project.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Meetings Section */}
          {activeSection === "meetings" && (
            <div className="space-y-4">
              {loadingData ? (
                <div className="text-center text-slate-400">
                  Loading meetings...
                </div>
              ) : meetings.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
                  No meetings found. Start a discussion to create your first
                  meeting!
                </div>
              ) : (
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <Link
                      key={meeting.id}
                      href={`/meetings/${meeting.id}`}
                      className="block"
                    >
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-400/40">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-100">
                              {meeting.name}
                            </h3>
                            <p className="mt-2 text-sm text-slate-400">
                              {new Date(
                                meeting.created_at,
                              ).toLocaleDateString()}{" "}
                              at{" "}
                              {new Date(
                                meeting.created_at,
                              ).toLocaleTimeString()}
                            </p>
                            {meeting.metadata?.summary && (
                              <p className="mt-3 line-clamp-2 text-sm text-slate-300">
                                {meeting.metadata.summary}
                              </p>
                            )}
                          </div>
                          <span
                            className={`ml-4 rounded-full px-3 py-1 text-xs font-semibold ${
                              meeting.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {meeting.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

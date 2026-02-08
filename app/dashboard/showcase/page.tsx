/**
 * @MODULE_ID app.dashboard.showcase
 * @STAGE global
 * @DATA_INPUTS ["agent_templates"]
 * @REQUIRED_TOOLS ["fetchAgentTemplates", "MAIN_AGENT_SYSTEM_PROMPT"]
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAgentTemplates,
  instantiateTemplates,
  type AgentTemplate,
} from "@/core/agent-factory";
import { MAIN_AGENT_SYSTEM_PROMPT } from "@/core/agent-prompts";
import { useTenant } from "@/core/tenant-context";
import { supabase } from "@/core/supabase";

export const dynamic = 'force-dynamic';

type AgentShowcase = {
  id: string;
  icon: string;
  title: string;
  description: string;
  roi: string;
  category: string;
  isActive: boolean;
  isAvailable: boolean;
  searchKeywords: string[];
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

const AGENT_SHOWCASE = [
  {
    id: "tax-optimizer",
    icon: "🧾",
    title: "Der Steuer-Optimierer",
    description: "Optimiert Schweizer Steuerlast durch saubere Abzüge.",
    roi: "Reduziert steuerliche Reibung durch strukturierte Abzüge, Timing und Einkommensglättung.",
    category: "Finanzen",
    searchKeywords: ["steuern", "abzug", "optimierung", "steuerlast"],
  },
  {
    id: "inheritance-planner",
    icon: "🧬",
    title: "Der Erbschafts-Planer",
    description: "Strukturiert Vermögensübergabe und Pflichtanteile.",
    roi: "Minimiert Übergabekosten und rechtliche Risiken durch klare Strukturierung.",
    category: "Recht",
    searchKeywords: ["erbschaft", "nachlass", "pflichtteil", "erbengemeinschaft"],
  },
  {
    id: "crypto-guardian",
    icon: "₿",
    title: "Der Krypto-Guardian",
    description: "Bewertet Risiko, Verwahrung und Steuerfolgen von Crypto.",
    roi: "Schützt vor Volatilitäts- und Compliance-Fallen durch klare Limits.",
    category: "Technik",
    searchKeywords: ["crypto", "wallet", "risiko", "volatilität"],
  },
  {
    id: "fee-hunter",
    icon: "📉",
    title: "Der Gebühren-Jäger",
    description: "Findet versteckte Gebühren und Rebalancing-Verluste.",
    roi: "Sichert Rendite, indem unnötige Gebührenströme eliminiert werden.",
    category: "Finanzen",
    searchKeywords: ["gebühren", "fee", "rebalancing", "kosten"],
  },
];

const PROBLEM_CLOUD = [
  { label: "Miete zu hoch", query: "miete", category: "Recht" },
  { label: "ETF-Check", query: "etf", category: "Finanzen" },
  { label: "Laborwerte verstehen", query: "laborwerte", category: "Medizin" },
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

const isSubsequence = (query: string, target: string) => {
  let index = 0;
  for (const char of target) {
    if (char === query[index]) {
      index += 1;
    }
    if (index >= query.length) return true;
  }
  return false;
};

const levenshtein = (a: string, b: string) => {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
};

const fuzzyMatch = (query: string, target: string) => {
  if (!query) return true;
  if (target.includes(query)) return true;
  if (query.length >= 3 && isSubsequence(query, target)) return true;
  const words = target.split(/\s+/g);
  const threshold = query.length <= 4 ? 1 : 2;
  return words.some((word) => levenshtein(query, word) <= threshold);
};

const ShowcasePage = () => {
  const { organization } = useTenant();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentShowcase | null>(null);
  const [showArchitectChat, setShowArchitectChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [activeProblem, setActiveProblem] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTemplates = async () => {
      const { data, error } = await fetchAgentTemplates(organization?.id);
      if (!isMounted) return;
      if (error) {
        setTemplates([]);
        return;
      }
      setTemplates(instantiateTemplates(data));
    };

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, [organization?.id]);

  useEffect(() => {
    let isMounted = true;

    const resolveUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    };

    resolveUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const templateIndex = useMemo(() => {
    return templates.reduce<Record<string, AgentTemplate[]>>((acc, template) => {
      if (!acc[template.name]) {
        acc[template.name] = [];
      }
      acc[template.name].push(template);
      return acc;
    }, {});
  }, [templates]);

  const hiddenAgents = useMemo(
    () => new Set(["Vault-Guardian", "Registrar"]),
    [],
  );

  const galleryAgents = useMemo(() => {
    const results: AgentShowcase[] = [];
    const usedNames = new Set<string>();
    const fallbackRoi =
      "Fokussierte Expertise reduziert Entscheidungsrisiken und beschleunigt die Umsetzung.";

    AGENT_SHOWCASE.forEach((agent) => {
      const matches = templateIndex[agent.title] ?? [];
      const orgTemplate = matches.find(
        (template) => template.organizationId === organization?.id,
      );
      const globalTemplate = matches.find(
        (template) => template.organizationId === null,
      );

      const source = orgTemplate ?? globalTemplate;
      const isActive = Boolean(orgTemplate);
      const isAvailable = Boolean(globalTemplate) || !isActive;

      results.push({
        id: agent.id,
        icon: source?.icon ?? agent.icon,
        title: source?.name ?? agent.title,
        description: source?.description ?? agent.description,
        roi: agent.roi,
        category: source?.category ?? agent.category,
        isActive,
        isAvailable,
        searchKeywords: source?.searchKeywords ?? agent.searchKeywords,
      });

      usedNames.add(agent.title);
    });

    templates.forEach((template) => {
      if (hiddenAgents.has(template.name)) return;
      if (usedNames.has(template.name)) return;
      results.push({
        id: template.id,
        icon: template.icon ?? "🧠",
        title: template.name,
        description: template.description,
        roi: fallbackRoi,
        category: template.category ?? "General",
        isActive: template.organizationId === organization?.id,
        isAvailable: template.organizationId === null,
        searchKeywords: template.searchKeywords,
      });
    });

    return results;
  }, [hiddenAgents, organization?.id, templateIndex, templates]);

  const filteredAgents = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    return galleryAgents.filter((agent) => {
      if (agent.category === "Infrastruktur" && userEmail !== "test@zasterix.ch") {
        return false;
      }
      const matchesCategory =
        activeCategory === "Alle" || agent.category === activeCategory;
      if (!matchesCategory) return false;
      if (!normalizedSearch) return true;
      const haystack = normalizeText(
        `${agent.title} ${agent.description} ${agent.category} ${agent.searchKeywords.join(" ")}`,
      );
      return fuzzyMatch(normalizedSearch, haystack);
    });
  }, [activeCategory, galleryAgents, searchTerm, userEmail]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const query = searchTerm.trim();
    if (!query) {
      return () => {
        if (timeoutId) window.clearTimeout(timeoutId);
      };
    }

    timeoutId = window.setTimeout(() => {
      supabase.from("search_logs").insert({
        user_id: userId,
        organization_id: organization?.id ?? null,
        query,
        results_found: filteredAgents.length > 0,
      });
    }, 350);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [filteredAgents.length, organization?.id, searchTerm, userId]);

  useEffect(() => {
    if (!showArchitectChat) {
      setMessages([]);
      setChatInput("");
      return;
    }
    setMessages([{ role: "system", content: MAIN_AGENT_SYSTEM_PROMPT }]);
  }, [showArchitectChat]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: chatInput.trim() }]);
    setChatInput("");
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Agent-Showcase</span>
          <span>Infinite Gallery</span>
        </div>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <input
            className="w-full rounded-2xl border border-slate-800/80 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none lg:max-w-md"
            placeholder="Suche nach Agenten, Nutzen oder Kategorie..."
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
            {[
              "Alle",
              "Finanzen",
              "Recht",
              "Medizin",
              ...(userEmail === "test@zasterix.ch" ? ["Infrastruktur"] : []),
            ].map((category) => (
              <button
                key={category}
                className={`rounded-full px-3 py-2 ${
                  activeCategory === category
                    ? "bg-emerald-500 text-slate-900"
                    : "border border-slate-800/80 text-slate-300"
                }`}
                type="button"
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
          <span>Häufige Probleme:</span>
          {PROBLEM_CLOUD.map((problem) => (
            <button
              key={problem.label}
              className={`rounded-full px-3 py-2 ${
                activeProblem === problem.label
                  ? "bg-emerald-500 text-slate-900"
                  : "border border-slate-800/80 text-slate-300"
              }`}
              type="button"
              onClick={() => {
                setActiveProblem(problem.label);
                setSearchTerm(problem.query);
                setActiveCategory(problem.category);
              }}
            >
              {problem.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {filteredAgents.length === 0 ? (
            <button
              className="flex w-full flex-col justify-between rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-4 text-left text-sm text-emerald-200 transition hover:border-emerald-300"
              type="button"
              onClick={() => setShowArchitectChat(true)}
            >
              <div className="space-y-2">
                <span className="text-xl">✨</span>
                <h3 className="text-base font-semibold">
                  Agent nicht gefunden? Lass den Architect einen neuen bauen!
                </h3>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">
                  Beschreibe den Case und starte den Bauprozess.
                </p>
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-emerald-200">
                Architect-Chat öffnen
              </div>
            </button>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {filteredAgents.map((agent) => {
                const statusLabel = agent.isActive
                  ? "Aktiviert"
                  : agent.isAvailable
                    ? "Verfügbar"
                    : "Nicht verfügbar";
                return (
                  <div
                    key={agent.id}
                    className="flex h-full flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 text-left text-sm text-slate-200 transition hover:border-emerald-400/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xl">{agent.icon}</span>
                      <div className="flex items-center gap-2">
                        {agent.isActive ? (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.2em] ${
                            agent.isActive
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-100">
                          {agent.title}
                        </h3>
                        <span className="text-[9px] uppercase tracking-[0.2em] text-emerald-300">
                          {agent.category}
                        </span>
                      </div>
                      <p
                        className="text-xs text-slate-400 truncate"
                        title={agent.description}
                      >
                        {agent.description}
                      </p>
                    </div>
                    <button
                      className="mt-3 rounded-full border border-emerald-400/40 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-emerald-200 hover:border-emerald-300"
                      type="button"
                      onClick={() => setSelectedAgent(agent)}
                    >
                      Start
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedAgent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-[0_25px_60px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {selectedAgent.icon} {selectedAgent.title}
              </h3>
              <button
                className="text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200"
                type="button"
                onClick={() => setSelectedAgent(null)}
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-300">
              {selectedAgent.roi}
            </p>
          </div>
        </div>
      ) : null}

      {showArchitectChat ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-[0_25px_60px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Zasterix Architect</h3>
              <button
                className="text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200"
                type="button"
                onClick={() => setShowArchitectChat(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 text-xs text-slate-300">
              {messages.map((message, index) => (
                <p key={`${message.role}-${index}`} className="mt-2">
                  <span className="text-emerald-300">
                    {message.role === "system" ? "SYSTEM" : "USER"}:
                  </span>{" "}
                  {message.content}
                </p>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="flex-1 rounded-2xl border border-slate-700/80 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none"
                placeholder="Beschreibe deinen Spezial-Case..."
                type="text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button
                className="rounded-full bg-emerald-500 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-900 hover:bg-emerald-400"
                type="button"
                onClick={handleSend}
              >
                Senden
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ShowcasePage;

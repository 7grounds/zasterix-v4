/**
 * @MODULE_ID app.admin.gaps
 * @STAGE admin
 * @DATA_INPUTS ["search_logs"]
 * @REQUIRED_TOOLS ["supabase", "MAIN_AGENT_SYSTEM_PROMPT"]
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/core/supabase";
import { MAIN_AGENT_SYSTEM_PROMPT } from "@/core/agent-prompts";
import { useTenant } from "@/core/tenant-context";

type GapEntry = {
  query: string;
  count: number;
};

type DropoffEntry = {
  step: string;
  count: number;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

const AdminGapsPage = () => {
  const { organization } = useTenant();
  const [gaps, setGaps] = useState<GapEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [dropoffs, setDropoffs] = useState<DropoffEntry[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadGaps = async () => {
      if (!organization?.id) {
        setGaps([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data, error } = await supabase
        .from("search_logs")
        .select("query, results_found")
        .eq("organization_id", organization.id)
        .eq("results_found", false);

      if (!isMounted) return;
      if (error || !data) {
        setGaps([]);
        setIsLoading(false);
        return;
      }

      const counts = data.reduce<Record<string, number>>((acc, row) => {
        const query = row.query.trim();
        if (!query) return acc;
        acc[query] = (acc[query] ?? 0) + 1;
        return acc;
      }, {});

      const entries = Object.entries(counts)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setGaps(entries);
      setIsLoading(false);
    };

    const loadDropoffs = async () => {
      if (!organization?.id) {
        setDropoffs([]);
        return;
      }

      const { data, error } = await supabase
        .from("user_flows")
        .select("current_step, status")
        .eq("organization_id", organization.id)
        .eq("status", "active");

      if (!isMounted) return;
      if (error || !data) {
        setDropoffs([]);
        return;
      }

      const counts = data.reduce<Record<string, number>>((acc, row) => {
        const step = row.current_step?.trim() || "Unbekannt";
        acc[step] = (acc[step] ?? 0) + 1;
        return acc;
      }, {});

      const entries = Object.entries(counts)
        .map(([step, count]) => ({ step, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      setDropoffs(entries);
    };

    loadGaps();
    loadDropoffs();

    return () => {
      isMounted = false;
    };
  }, [organization?.id]);

  useEffect(() => {
    if (!selectedQuery) {
      setMessages([]);
      setChatInput("");
      return;
    }
    setMessages([
      { role: "system", content: MAIN_AGENT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Bitte erstelle einen Spezial-Agenten für das Thema: ${selectedQuery}.`,
      },
    ]);
  }, [selectedQuery]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: chatInput.trim() }]);
    setChatInput("");
  };

  const selectedSummary = useMemo(() => {
    if (!selectedQuery) return null;
    return `Agent jetzt erstellen: ${selectedQuery}`;
  }, [selectedQuery]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-6 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Health Dashboard</span>
          <span>Systemstatus</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              System-Stabilität
            </p>
            <p className="mt-2 text-lg font-semibold text-emerald-300">
              99.9%
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Durchschnittliche Latenz
            </p>
            <p className="mt-2 text-lg font-semibold text-emerald-300">
              1.2s
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Gap Analysis</span>
          <span>Search Logs</span>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading gaps...</p>
          ) : gaps.length === 0 ? (
            <p className="text-sm text-slate-400">
              Keine fehlenden Suchbegriffe gefunden.
            </p>
          ) : (
            <div className="space-y-3">
              {gaps.map((gap) => (
                <div
                  key={gap.query}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                >
                  <div>
                    <p className="font-semibold text-slate-100">{gap.query}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {gap.count} ohne Treffer
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-emerald-400/40 px-4 py-2 text-xs uppercase tracking-[0.24em] text-emerald-200 hover:border-emerald-300"
                    type="button"
                    onClick={() => setSelectedQuery(gap.query)}
                  >
                    Agent jetzt erstellen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Drop-off Analysis</span>
          <span>User Flows</span>
        </div>
        <div className="mt-6">
          {dropoffs.length === 0 ? (
            <p className="text-sm text-slate-400">
              Keine Drop-off Daten verfügbar.
            </p>
          ) : (
            <div className="space-y-3">
              {dropoffs.map((entry) => (
                <div
                  key={entry.step}
                  className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                >
                  <span className="font-semibold text-slate-100">
                    {entry.step}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {entry.count} Nutzer
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Architect Chat</span>
          <span>{selectedSummary ?? "Idle"}</span>
        </div>
        {selectedQuery ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 text-xs text-slate-300">
              {messages.map((message, index) => (
                <p key={`${message.role}-${index}`} className="mt-2">
                  <span className="text-emerald-300">
                    {message.role === "system" ? "SYSTEM" : "USER"}:
                  </span>{" "}
                  {message.content}
                </p>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="flex-1 rounded-2xl border border-slate-700/80 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none"
                placeholder="Zusätzliche Hinweise für den Architect..."
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
        ) : (
          <p className="mt-5 text-sm text-slate-400">
            Wähle einen Gap-Begriff, um den Architect zu starten.
          </p>
        )}
      </section>
    </div>
  );
};

export default AdminGapsPage;

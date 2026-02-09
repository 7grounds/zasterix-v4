/**
 * @MODULE_ID app.zasterix-vault
 * @STAGE admin
 * @DATA_INPUTS ["universal_history"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type HistoryEntry = {
  id?: string;
  payload?: any;
  created_at?: string | null;
};

const renderPayload = (payload: any) => {
  if (!payload || typeof payload !== "object") {
    return <span>{String(payload ?? "--")}</span>;
  }

  const entries = Object.entries(payload);
  if (entries.length === 0) {
    return <span>(empty)</span>;
  }

  return (
    <ul className="space-y-1">
      {entries.map(([key, value]) => (
        <li key={key}>
          <span className="text-emerald-300">{key}:</span>{" "}
          <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
        </li>
      ))}
    </ul>
  );
};

export default function VaultPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const hasKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!hasUrl || !hasKey) {
      setError("Supabase env missing (NEXT_PUBLIC_...).");
      return () => {
        isMounted = false;
      };
    }

    const loadHistory = async () => {
      const { data, error: fetchError } = await supabase
        .from("universal_history")
        .select("id, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message || "Failed to load history.");
        setHistory([]);
        return;
      }

      setError(null);
      setHistory((data as HistoryEntry[]) ?? []);
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
          Zasterix Vault
        </p>
        <h1 className="text-3xl font-semibold text-slate-100">
          Private Boardroom Feed
        </h1>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-4 text-lg font-semibold text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">Keine Einträge vorhanden.</p>
        ) : (
          history.map((entry, index) => (
            <div
              key={entry.id ?? `row-${index}`}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 text-sm text-slate-200"
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                {entry.created_at ?? "--"}
              </div>
              <div className="mt-2 text-xs text-slate-200">
                {renderPayload(entry.payload)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

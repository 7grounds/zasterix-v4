/**
 * @MODULE_ID app.vault
 * @STAGE admin
 * @DATA_INPUTS ["universal_history"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

console.log("Vault Page geladen");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface VaultItem {
  id: string | number;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toVaultItems = (rows: unknown): VaultItem[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row, index) => {
    const record = asRecord(row);
    const idValue = record?.id;

    return {
      id:
        typeof idValue === "string" || typeof idValue === "number"
          ? idValue
          : `row-${index}`,
      payload: asRecord(record?.payload),
      created_at: typeof record?.created_at === "string" ? record.created_at : null,
    };
  });
};

const renderPayload = (payload: unknown) => {
  const payloadRecord = asRecord(payload);

  if (!payloadRecord) {
    return <span>{String(payload ?? "--")}</span>;
  }

  const entries = Object.entries(payloadRecord);
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
  const [history, setHistory] = useState<VaultItem[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      const { data, error: fetchError } = await supabase
        .from("universal_history")
        .select("id, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError);
        setHistory([]);
        return;
      }

      setError(null);
      setHistory(toVaultItems(data));
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
          ROHBAU-TEST ERFOLGREICH
        </h1>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="space-y-3">
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">Keine Einträge vorhanden.</p>
        ) : (
          history.map((entry, index) => (
            <div
              key={entry?.id ?? `row-${index}`}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 text-sm text-slate-200"
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                {entry?.created_at ?? "--"}
              </div>
              <div className="mt-2 text-xs text-slate-200">
                {renderPayload(entry?.payload)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * @MODULE_ID app.zasterix-vault.dashboard
 * @STAGE admin
 * @DATA_INPUTS ["universal_history"]
 * @REQUIRED_TOOLS ["supabase"]
 */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Database } from "@/core/types/database.types";
import { DynamicPayloadRenderer } from "@/shared/components/DynamicPayloadRenderer";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type VaultDashboardProps = {
  debugMode?: boolean;
};

type UniversalHistoryRow =
  Database["public"]["Tables"]["universal_history"]["Row"];

const formatTimestamp = (value: string | null) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const VaultDashboard = ({ debugMode = false }: VaultDashboardProps) => {
  const [history, setHistory] = useState<UniversalHistoryRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setStatus("loading");
      const { data, error } = await supabase
        .from("universal_history")
        .select("id, payload, summary_payload, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!isMounted) return;
      if (error) {
        console.error("Vault universal_history fetch failed:", error);
        console.error("Vault env check:", {
          hasSupabaseUrl: Boolean(envUrl),
          hasSupabaseAnonKey: Boolean(envAnonKey),
        });
        setStatus("error");
        setErrorMessage(error.message);
        const meta = [
          error.code ? `code: ${error.code}` : null,
          error.details ? `details: ${error.details}` : null,
          error.hint ? `hint: ${error.hint}` : null,
          typeof (error as { status?: number }).status === "number"
            ? `status: ${(error as { status: number }).status}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        setErrorDetails(meta || null);
        setHistory([]);
        return;
      }
      setErrorMessage(null);
      setErrorDetails(null);
      setHistory((data ?? []) as UniversalHistoryRow[]);
      setStatus("idle");
    };

    loadHistory();

    const channel = supabase
      .channel("universal_history")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "universal_history" },
        (payload) => {
          const incoming = payload.new as UniversalHistoryRow | undefined;
          if (!incoming || !incoming.id) return;
          setHistory((prev) => {
            const filtered = prev.filter((item) => item.id !== incoming.id);
            return [incoming, ...filtered].slice(0, 50);
          });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!debugMode) return;
    console.info("Vault env status:", {
      hasSupabaseUrl: Boolean(envUrl),
      hasSupabaseAnonKey: Boolean(envAnonKey),
    });
  }, [debugMode]);

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
          Zasterix Vault
        </p>
        <h1 className="text-3xl font-semibold text-slate-100">
          Private Boardroom Feed
        </h1>
        <p className="text-sm text-slate-400">
          Live protocol stream from universal_history.
        </p>
      </header>

      {debugMode ? (
        <section className="rounded-2xl border border-slate-800/70 bg-slate-950/80 px-4 py-4 text-sm text-slate-200">
          <div className="text-xs uppercase tracking-[0.24em] text-emerald-300">
            System Status
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-300">
            <p>hasUrl: {Boolean(envUrl) ? "true" : "false"}</p>
            <p>hasKey: {Boolean(envAnonKey) ? "true" : "false"}</p>
            {status === "error" ? (
              <div className="mt-2 space-y-1 text-rose-200">
                <p>Error: {errorMessage ?? "unknown"}</p>
                {errorDetails ? <p>{errorDetails}</p> : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {status === "error" ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <p>Verbindung zur Datenbank fehlgeschlagen.</p>
          {errorMessage ? (
            <p className="mt-2 text-xs text-rose-200/80">
              {errorMessage}
            </p>
          ) : null}
          {errorDetails ? (
            <p className="mt-2 text-xs text-rose-200/70">
              {errorDetails}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">Keine Einträge vorhanden.</p>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 text-sm text-slate-200"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                <span>{formatTimestamp(entry.created_at)}</span>
                <span>
                  {entry.summary_payload ? "Summary" : "Payload"}
                </span>
              </div>
              <div className="mt-3">
                <DynamicPayloadRenderer
                  payload={entry.summary_payload ?? entry.payload}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

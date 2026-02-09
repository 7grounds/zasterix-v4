/**
 * @MODULE_ID app.zasterix-vault.dashboard
 * @STAGE admin
 * @DATA_INPUTS ["universal_history"]
 * @REQUIRED_TOOLS ["supabase"]
 */
"use client";

import { useEffect } from "react";
import type { Database } from "@/core/types/database.types";
import { DynamicPayloadRenderer } from "@/shared/components/DynamicPayloadRenderer";

type UniversalHistoryRow =
  Database["public"]["Tables"]["universal_history"]["Row"];

const clientHasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const clientHasKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

type VaultDashboardProps = {
  debugMode?: boolean;
  initialHistory?: UniversalHistoryRow[];
  serverErrorMessage?: string | null;
  serverErrorDetails?: string | null;
  serverEnvStatus?: {
    hasUrl: boolean;
    hasKey: boolean;
  };
};

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

export const VaultDashboard = ({
  debugMode = false,
  initialHistory = [],
  serverErrorMessage = null,
  serverErrorDetails = null,
  serverEnvStatus,
}: VaultDashboardProps) => {
  const history = initialHistory ?? [];
  const hasError = Boolean(serverErrorMessage || serverErrorDetails);

  useEffect(() => {
    if (!debugMode) return;
    console.info("Vault client env status:", {
      hasSupabaseUrl: clientHasUrl,
      hasSupabaseAnonKey: clientHasKey,
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
            <p>hasUrl: {serverEnvStatus?.hasUrl ? "true" : "false"}</p>
            <p>hasKey: {serverEnvStatus?.hasKey ? "true" : "false"}</p>
            {hasError ? (
              <div className="mt-2 space-y-1 text-rose-200">
                <p>Error: {serverErrorMessage ?? "unknown"}</p>
                {serverErrorDetails ? <p>{serverErrorDetails}</p> : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <p>Verbindung zur Datenbank fehlgeschlagen.</p>
          {serverErrorMessage ? (
            <p className="mt-2 text-xs text-rose-200/80">
              {serverErrorMessage}
            </p>
          ) : null}
          {serverErrorDetails ? (
            <p className="mt-2 text-xs text-rose-200/70">
              {serverErrorDetails}
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

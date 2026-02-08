/**
 * @MODULE_ID app.admin.boardroom
 * @STAGE admin
 * @DATA_INPUTS ["agent_templates", "management_log"]
 * @REQUIRED_TOOLS ["supabase"]
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/core/supabase";
import type { Database } from "@/core/types/database.types";
import { useTenant } from "@/core/tenant-context";

export const dynamic = 'force-dynamic';

type AgentTemplateRow =
  Database["public"]["Tables"]["agent_templates"]["Row"];

type ManagementLogRow =
  Database["public"]["Tables"]["universal_history"]["Row"];

const BOARD_AGENTS = [
  { key: "growth", name: "Growth" },
  { key: "evolution", name: "Evolution" },
  { key: "dev", name: "Dev-Ops Bot" },
  { key: "guardian", name: "Vault-Guardian" },
  { key: "coordinator", name: "Koordinator" },
  { key: "manager", name: "Master-Manager" },
  { key: "resource", name: "Resource-Controller" },
];

const BoardroomPage = () => {
  const { organization } = useTenant();
  const [agents, setAgents] = useState<AgentTemplateRow[]>([]);
  const [logs, setLogs] = useState<ManagementLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const primaryProvider =
    process.env.NEXT_PUBLIC_AI_PRIMARY_PROVIDER ?? "unconfigured";
  const backupProviders = (process.env.NEXT_PUBLIC_AI_BACKUP_PROVIDERS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  useEffect(() => {
    let isMounted = true;

    const loadBoardroom = async () => {
      if (!organization?.id) {
        setAgents([]);
        setLogs([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data: agentRows } = await supabase
        .from("agent_templates")
        .select("id, name, description, icon, category")
        .in(
          "name",
          BOARD_AGENTS.map((agent) => agent.name),
        );

      const { data: logRows } = await supabase
        .from("universal_history")
        .select("id, payload, created_at")
        .eq("organization_id", organization.id)
        .eq("payload->>type", "management_log")
        .order("created_at", { ascending: false })
        .limit(8);

      if (!isMounted) return;
      setAgents((agentRows ?? []) as AgentTemplateRow[]);
      setLogs((logRows ?? []) as ManagementLogRow[]);
      setIsLoading(false);
    };

    loadBoardroom();

    return () => {
      isMounted = false;
    };
  }, [organization?.id]);

  const agentMap = useMemo(() => {
    return agents.reduce<Record<string, AgentTemplateRow>>((acc, agent) => {
      acc[agent.name] = agent;
      return acc;
    }, {});
  }, [agents]);

  const summaries = useMemo(() => {
    return logs.map((log) => {
      if (log.payload && typeof log.payload === "object") {
        const record = log.payload as Record<string, unknown>;
        return {
          id: log.id,
          agent: String(record.agent_name ?? "Management"),
          summary: String(record.summary ?? record.details ?? "Update"),
          createdAt: log.created_at ?? null,
        };
      }
      return {
        id: log.id,
        agent: "Management",
        summary: "Update",
        createdAt: log.created_at ?? null,
      };
    });
  }, [logs]);

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

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Management Board</span>
          <span>Boardroom</span>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          <span className="text-emerald-300">Brain-Provider:</span>{" "}
          {primaryProvider}
          {backupProviders.length ? (
            <span className="ml-2 text-slate-500">
              (Backups: {backupProviders.join(", ")})
            </span>
          ) : null}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BOARD_AGENTS.map((agent) => {
            const detail = agentMap[agent.name];
            const statusLabel = detail ? "Active" : "Missing";
            return (
              <div
                key={agent.key}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 text-sm text-slate-200"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100">
                    {detail?.icon ? `${detail.icon} ` : ""}
                    {agent.name}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {statusLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {detail?.description ?? "Agent nicht registriert."}
                </p>
                {detail?.category ? (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                    {detail.category}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Executive Summary</span>
          <span>Latest Updates</span>
        </div>
        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading boardroom...</p>
          ) : summaries.length === 0 ? (
            <p className="text-sm text-slate-400">
              Keine Executive Summaries verfügbar.
            </p>
          ) : (
            <div className="space-y-3">
              {summaries.map((summary) => (
                <div
                  key={summary.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>{summary.agent}</span>
                    <span>{formatTimestamp(summary.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-200">
                    {summary.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default BoardroomPage;

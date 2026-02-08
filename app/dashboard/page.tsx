/**
 * @MODULE_ID app.dashboard
 * @STAGE global
 * @DATA_INPUTS ["fetchUserProgress", "resetAllProgress", "assetCoachTasks", "assetIdentificationTasks", "feeMonsterTasks", "agent_definitions"]
 * @REQUIRED_TOOLS ["YuhConnector", "getButtonClasses", "fetchUserProgress", "resetAllProgress", "supabase", "agent-factory"]
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getButtonClasses } from "@/shared/components/Button";
import { YuhConnector } from "@/shared/tools/YuhConnector";
import { fetchUserProgress, resetAllProgress } from "@/core/progress";
import { supabase, isSupabaseConfigured } from "@/core/supabase";
import type { Database } from "@/core/types/database.types";
import { assetCoachTasks } from "@/features/stage-1/asset-coach/tasks.config";
import { assetIdentificationTasks } from "@/features/stage-1/asset-identification/tasks.config";
import { feeMonsterTasks } from "@/features/stage-2/fee-monster/tasks.config";
import {
  createAgentDefinition,
  fetchAgentDefinitions,
  instantiateAgents,
  type AgentInstance,
} from "@/core/agent-factory";
import { DynamicPayloadRenderer } from "@/shared/components/DynamicPayloadRenderer";

type UniversalHistoryRow =
  Database["public"]["Tables"]["universal_history"]["Row"];

type RecentAnalysesProps = {
  entries: UniversalHistoryRow[];
};

const formatDate = (value: string | null) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const RecentAnalyses = ({ entries }: RecentAnalysesProps) => {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">No history yet.</p>;
  }

  const getPayloadTitle = (
    payload: Database["public"]["Tables"]["universal_history"]["Row"]["payload"],
  ) => {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      if (typeof record.title === "string" && record.title.trim()) {
        return record.title;
      }
      if (typeof record.name === "string" && record.name.trim()) {
        return record.name;
      }
      if (typeof record.type === "string" && record.type.trim()) {
        return record.type;
      }
    }
    return "History Entry";
  };

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-col gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-100">
              {getPayloadTitle(entry.payload)}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {formatDate(entry.created_at)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
            <span>Org: {entry.organization_id ?? "--"}</span>
          </div>
          <DynamicPayloadRenderer payload={entry.payload} />
        </div>
      ))}
    </div>
  );
};

const DashboardPage = () => {
  const defaultStage = "stage-1";
  const defaultModule = "asset-coach";
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    stageId: string | null;
    moduleId: string | null;
    completedTasks: string[];
  } | null>(null);
  const [assetHistory, setAssetHistory] = useState<UniversalHistoryRow[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "special-tools">(
    "overview",
  );
  const [agentInstances, setAgentInstances] = useState<AgentInstance[]>([]);
  const [agentTask, setAgentTask] = useState("");
  const [agentError, setAgentError] = useState<string | null>(null);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProgress = async () => {
      if (!isSupabaseConfigured) {
        if (!isMounted) return;
        setIsLoading(false);
        setLastSync(new Date().toISOString());
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (error || !data.user) {
        setProgress(null);
        setAssetHistory([]);
        setIsLoading(false);
        setLastSync(new Date().toISOString());
        return;
      }

      setUserEmail(data.user.email ?? null);

      const latest = await fetchUserProgress(data.user.id);
      if (!isMounted) return;

      setProgress(
        latest
          ? {
              stageId: latest.stageId,
              moduleId: latest.moduleId,
              completedTasks: latest.completedTasks ?? [],
            }
          : null,
      );

      const { data: historyRows, error: historyError } = await supabase
        .from("universal_history")
        .select(
          "id, user_id, organization_id, payload, summary_payload, created_at",
        )
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!isMounted) return;
      setAssetHistory(historyError ? [] : historyRows ?? []);

      setIsLoading(false);
      setLastSync(latest?.updatedAt ?? new Date().toISOString());
    };

    fetchProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAgents = async () => {
      const { data, error } = await fetchAgentDefinitions();
      if (!isMounted) return;
      if (error) {
        setAgentInstances([]);
        return;
      }
      setAgentInstances(instantiateAgents(data));
    };

    loadAgents();

    return () => {
      isMounted = false;
    };
  }, []);

  const stageId = progress?.stageId ?? defaultStage;
  const moduleId = progress?.moduleId ?? defaultModule;
  const moduleKey = `${stageId}/${moduleId}`;
  const defaultKey = `${defaultStage}/${defaultModule}`;

  const taskRegistry: Record<string, { id: string }[]> = {
    "stage-1/asset-coach": assetCoachTasks,
    "stage-1/asset-identification": assetIdentificationTasks,
    "stage-2/fee-monster": feeMonsterTasks,
  };

  const moduleMeta: Record<
    string,
    { title: string; description: string; accent: string }
  > = {
    "stage-1/asset-coach": {
      title: "Stage 1: Asset-Coach",
      description:
        "AI-powered asset diagnostics built for Swiss wealth engineering. Stress-test assets before they enter the Yuh portfolio workflow.",
      accent: "Active Module",
    },
    "stage-1/asset-identification": {
      title: "Stage 1: Asset Identification",
      description:
        "Map the full asset inventory to provide the AI coach with a precise wealth baseline.",
      accent: "Active Module",
    },
    "stage-2/fee-monster": {
      title: "Stage 2: The Fee-Monster",
      description:
        "Expose fee drag, compare alternatives, and engineer order sizing that protects compounding.",
      accent: "Active Module",
    },
  };

  const activeTasks = taskRegistry[moduleKey] ?? taskRegistry[defaultKey];
  const totalTasks = activeTasks?.length ?? 0;
  const completedCount = Math.min(
    progress?.completedTasks.length ?? 0,
    totalTasks,
  );
  const progressPercent = useMemo(() => {
    if (!totalTasks) return 0;
    return (completedCount / totalTasks) * 100;
  }, [completedCount, totalTasks]);

  const hasProgress = Boolean(progress?.stageId && progress?.moduleId);
  const isModuleCompleted = hasProgress && completedCount >= totalTasks;

  const activeMeta = moduleMeta[moduleKey] ?? moduleMeta[defaultKey];
  const stageNumber = stageId.replace("stage-", "");
  const primaryLabel = hasProgress
    ? `Continue Stage ${stageNumber}`
    : "Start Stage 1";

  const buildModuleRoute = (stage: string, module: string) => {
    const normalizedStage = stage.startsWith("stage-")
      ? stage
      : `stage-${stage}`;
    return `/${normalizedStage}/${module}`;
  };

  const primaryHref = hasProgress
    ? buildModuleRoute(stageId, moduleId)
    : buildModuleRoute(defaultStage, defaultModule);

  const showNextModule =
    stageId === "stage-1" && isModuleCompleted && moduleId !== "fee-monster";
  const nextModuleHref = "/stage-2/fee-monster";

  const showDevReset = process.env.NODE_ENV === "development";

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

  const handleDevReset = async () => {
    if (!isSupabaseConfigured) {
      window.location.reload();
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      window.location.reload();
      return;
    }

    await resetAllProgress(data.user.id);
    window.location.reload();
  };

  const toolTiles = [
    {
      id: "asset-check",
      label: "Asset-Check",
      href: "/stage-1/asset-coach",
      external: false,
    },
    {
      id: "fee-calculator",
      label: "Fee-Calculator",
      href: "/stage-2/fee-monster",
      external: false,
    },
    {
      id: "yuh-link",
      label: "Yuh-Link",
      href: "yuh://connect",
      external: true,
    },
  ];

  const isAdmin = userEmail === "test@zasterix.ch";

  const handleCreateAgent = async () => {
    if (!agentTask.trim()) {
      setAgentError("Bitte eine Task-Beschreibung eingeben.");
      return;
    }

    setAgentError(null);
    setIsCreatingAgent(true);

    const { data, error } = await createAgentDefinition({
      task: agentTask,
    });

    if (error || !data) {
      setAgentError(error?.message ?? "Agent konnte nicht erstellt werden.");
      setIsCreatingAgent(false);
      return;
    }

    const newInstance = instantiateAgents([data])[0];
    setAgentInstances((prev) => (newInstance ? [newInstance, ...prev] : prev));
    setAgentTask("");
    setIsCreatingAgent(false);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.24em] ${
            activeTab === "overview"
              ? "bg-emerald-500 text-slate-900"
              : "border border-slate-800/70 text-slate-300"
          }`}
          type="button"
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.24em] ${
            activeTab === "special-tools"
              ? "bg-emerald-500 text-slate-900"
              : "border border-slate-800/70 text-slate-300"
          }`}
          type="button"
          onClick={() => setActiveTab("special-tools")}
        >
          Spezial-Tools
        </button>
      </div>

      {activeTab === "overview" ? (
        <>
          <section className="rounded-3xl bg-slate-950 px-8 py-10 text-slate-100 shadow-[0_25px_60px_rgba(15,23,42,0.4)]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
                {activeMeta.accent}
              </p>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-semibold">{activeMeta.title}</h2>
                  {isModuleCompleted ? (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                      ✓ Completed
                    </span>
                  ) : null}
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
                  {activeMeta.description}
                </p>
                {showNextModule ? (
                  <Link
                    className="text-xs uppercase tracking-[0.24em] text-emerald-300 hover:text-emerald-200"
                    href={nextModuleHref}
                  >
                    Next Module: Stage 2 / Fee-Monster
                  </Link>
                ) : null}
              </div>
              <div className="pt-2">
                <Link
                  className={getButtonClasses("action", "md")}
                  href={primaryHref}
                >
                  {primaryLabel}
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/10 px-8 py-8 text-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-300">
              <span>Progress Overview</span>
              <span>{stageId}</span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-100">
                <span className="font-medium text-emerald-400">
                  {isLoading ? "Syncing..." : `Progress: ${progressPercent}%`}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-300">
                  {completedCount} / {totalTasks} Tasks
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800/80">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="mt-6 text-xs uppercase tracking-[0.24em] text-slate-400">
              Last Sync: {lastSyncLabel}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>Recent History</span>
              <span>Last 5</span>
            </div>
            <div className="mt-5">
              <RecentAnalyses entries={assetHistory} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>Available Tools</span>
              <span>Quick Access</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {toolTiles.map((tool) =>
                tool.external ? (
                  <a
                    key={tool.id}
                    className="flex items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 text-xs uppercase tracking-[0.24em] text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-200"
                    href={tool.href}
                  >
                    {tool.label}
                  </a>
                ) : (
                  <Link
                    key={tool.id}
                    className="flex items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 text-xs uppercase tracking-[0.24em] text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-200"
                    href={tool.href}
                  >
                    {tool.label}
                  </Link>
                ),
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Toolbox Quick Access
              </p>
              <h3 className="text-xl font-semibold text-slate-100">
                Yuh Connector
              </h3>
              <p className="text-sm text-slate-400">
                Launch Yuh directly from the dashboard to sync portfolios on demand.
              </p>
            </div>
            <div className="mt-6">
              <YuhConnector action="connect" label="Open Yuh" />
            </div>
          </section>

          {showDevReset ? (
            <div className="pt-2 text-xs text-slate-500">
              <button
                className="text-slate-500 hover:text-slate-300"
                type="button"
                onClick={handleDevReset}
              >
                Dev-Reset
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
            <span>Spezial-Tools</span>
            <span>Agent Registry</span>
          </div>

          <div className="mt-5 space-y-3">
            {agentInstances.length === 0 ? (
              <p className="text-sm text-slate-400">
                Keine Spezial-Agenten registriert.
              </p>
            ) : (
              agentInstances.map((agent) => (
                <div
                  key={agent.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">
                      {agent.icon ? `${agent.icon} ` : ""}
                      {agent.name}
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {agent.status ?? "active"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {agent.systemPrompt}
                  </p>
                </div>
              ))
            )}
          </div>

          {isAdmin ? (
            <div className="mt-6 space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
                Create Agent
              </p>
              <input
                className="w-full rounded-2xl border border-slate-700/80 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none"
                placeholder="Erstelle einen neuen Agenten für..."
                type="text"
                value={agentTask}
                onChange={(event) => setAgentTask(event.target.value)}
              />
              {agentError ? (
                <p className="text-xs uppercase tracking-[0.2em] text-rose-400">
                  {agentError}
                </p>
              ) : null}
              <button
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-900 hover:bg-emerald-400"
                type="button"
                onClick={handleCreateAgent}
                disabled={isCreatingAgent}
              >
                {isCreatingAgent ? "Creating..." : "Create Agent"}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
};

export default DashboardPage;

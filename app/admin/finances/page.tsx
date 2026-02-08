/**
 * @MODULE_ID app.admin.finances
 * @STAGE admin
 * @DATA_INPUTS ["billing_logs"]
 * @REQUIRED_TOOLS ["supabase", "simulateGrowthCost"]
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/core/supabase";
import type { Database } from "@/core/types/database.types";
import { simulateGrowthCost } from "@/core/cost-engine";
import { useTenant } from "@/core/tenant-context";

export const dynamic = 'force-dynamic';

type BillingLogRow = Database["public"]["Tables"]["billing_logs"]["Row"];

type CostPoint = {
  label: string;
  costUsd: number;
  costChf: number;
};

type AgentCost = {
  agentName: string;
  totalCost: number;
  requestCount: number;
  avgCost: number;
};

const formatCurrency = (value: number, currency: "USD" | "CHF") => {
  return `${currency} ${value.toFixed(2)}`;
};

const AdminFinancesPage = () => {
  const { organization } = useTenant();
  const [logs, setLogs] = useState<BillingLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [growthUsers, setGrowthUsers] = useState(1000);
  const [growthRequests, setGrowthRequests] = useState(3);
  const [growthTokens, setGrowthTokens] = useState(800);
  const [growthProvider, setGrowthProvider] =
    useState<"openai" | "anthropic" | "google">("openai");

  useEffect(() => {
    let isMounted = true;

    const loadLogs = async () => {
      if (!organization?.id) {
        setLogs([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from("billing_logs")
        .select(
          "id, user_id, organization_id, agent_name, provider, token_count, cost_usd, cost_chf, created_at",
        )
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: true });

      if (!isMounted) return;
      setLogs(error ? [] : (data ?? []));
      setIsLoading(false);
    };

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, [organization?.id]);

  const costCurve = useMemo<CostPoint[]>(() => {
    const grouped = logs.reduce<Record<string, CostPoint>>((acc, log) => {
      const dateKey = log.created_at
        ? new Date(log.created_at).toISOString().slice(0, 10)
        : "unknown";
      if (!acc[dateKey]) {
        acc[dateKey] = { label: dateKey, costUsd: 0, costChf: 0 };
      }
      acc[dateKey].costUsd += log.cost_usd ?? 0;
      acc[dateKey].costChf += log.cost_chf ?? 0;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label));
  }, [logs]);

  const topAgents = useMemo<AgentCost[]>(() => {
    const grouped = logs.reduce<Record<string, AgentCost>>((acc, log) => {
      const name = log.agent_name ?? "Unassigned";
      if (!acc[name]) {
        acc[name] = { agentName: name, totalCost: 0, requestCount: 0, avgCost: 0 };
      }
      acc[name].totalCost += log.cost_usd ?? 0;
      acc[name].requestCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .map((entry) => ({
        ...entry,
        avgCost: entry.requestCount ? entry.totalCost / entry.requestCount : 0,
      }))
      .sort((a, b) => a.avgCost - b.avgCost)
      .slice(0, 5);
  }, [logs]);

  const growthSimulation = useMemo(() => {
    return simulateGrowthCost({
      provider: growthProvider,
      avgTokensPerRequest: growthTokens,
      requestsPerUser: growthRequests,
      newUsers: growthUsers,
    });
  }, [growthProvider, growthRequests, growthTokens, growthUsers]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Kosten-Kurve</span>
          <span>Billing Logs</span>
        </div>
        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading costs...</p>
          ) : costCurve.length === 0 ? (
            <p className="text-sm text-slate-400">
              Noch keine Kosten-Daten verfügbar.
            </p>
          ) : (
            <div className="space-y-3">
              {costCurve.map((point) => (
                <div
                  key={point.label}
                  className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                >
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {point.label}
                  </span>
                  <div className="flex items-center gap-4">
                    <span>{formatCurrency(point.costUsd, "USD")}</span>
                    <span className="text-slate-400">
                      {formatCurrency(point.costChf, "CHF")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Profitabelste Agenten</span>
          <span>Cost Efficiency</span>
        </div>
        <div className="mt-6">
          {topAgents.length === 0 ? (
            <p className="text-sm text-slate-400">
              Keine Agenten-Kosten vorhanden.
            </p>
          ) : (
            <div className="space-y-3">
              {topAgents.map((agent) => (
                <div
                  key={agent.agentName}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                >
                  <div>
                    <p className="font-semibold text-slate-100">
                      {agent.agentName}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {agent.requestCount} Requests
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-emerald-300">
                      {formatCurrency(agent.avgCost, "USD")} / Request
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Total: {formatCurrency(agent.totalCost, "USD")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Growth Simulation</span>
          <span>Medizin-Bot</span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Neue Nutzer
            <input
              className="mt-2 w-full rounded-2xl border border-slate-800/80 bg-slate-900 px-4 py-2 text-sm text-slate-100"
              type="number"
              value={growthUsers}
              onChange={(event) => setGrowthUsers(Number(event.target.value))}
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Requests pro Nutzer
            <input
              className="mt-2 w-full rounded-2xl border border-slate-800/80 bg-slate-900 px-4 py-2 text-sm text-slate-100"
              type="number"
              value={growthRequests}
              onChange={(event) => setGrowthRequests(Number(event.target.value))}
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Ø Tokens pro Request
            <input
              className="mt-2 w-full rounded-2xl border border-slate-800/80 bg-slate-900 px-4 py-2 text-sm text-slate-100"
              type="number"
              value={growthTokens}
              onChange={(event) => setGrowthTokens(Number(event.target.value))}
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Provider
            <select
              className="mt-2 w-full rounded-2xl border border-slate-800/80 bg-slate-900 px-4 py-2 text-sm text-slate-100"
              value={growthProvider}
              onChange={(event) =>
                setGrowthProvider(event.target.value as typeof growthProvider)
              }
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
          </label>
        </div>
        <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
          <p>
            Erwartete Kosten: {formatCurrency(growthSimulation.costUsd, "USD")} /{" "}
            {formatCurrency(growthSimulation.costChf, "CHF")}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-200">
            Tokens: {growthSimulation.totalTokens} · Requests:{" "}
            {growthSimulation.totalRequests}
          </p>
        </div>
      </section>
    </div>
  );
};

export default AdminFinancesPage;

/**
 * @MODULE_ID app.admin.cockpit
 * @STAGE admin
 * @DATA_INPUTS ["registrar_log", "billing_logs"]
 * @REQUIRED_TOOLS ["supabase", "logManagementProtocol", "EXECUTIVE_APPROVAL_TOKEN"]
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/core/supabase";
import type { Database } from "@/core/types/database.types";
import { logManagementProtocol } from "@/core/agent-factory";
import { EXECUTIVE_APPROVAL_TOKEN } from "@/core/governance";
import { useTenant } from "@/core/tenant-context";

type RegistrarLog = Database["public"]["Tables"]["universal_history"]["Row"];
type BillingLog = Database["public"]["Tables"]["billing_logs"]["Row"];

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

const AdminCockpitPage = () => {
  const { organization } = useTenant();
  const [isAdmin, setIsAdmin] = useState(false);
  const [registrarLogs, setRegistrarLogs] = useState<RegistrarLog[]>([]);
  const [billingLogs, setBillingLogs] = useState<BillingLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const resolveUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setIsAdmin(data.user?.email === "test@zasterix.ch");
    };

    resolveUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!organization?.id) {
        setRegistrarLogs([]);
        setBillingLogs([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data: logs } = await supabase
        .from("universal_history")
        .select("id, payload, created_at")
        .eq("organization_id", organization.id)
        .eq("payload->>type", "registrar_log")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: costs } = await supabase
        .from("billing_logs")
        .select("provider, cost_usd, cost_chf, created_at")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!isMounted) return;
      setRegistrarLogs((logs ?? []) as RegistrarLog[]);
      setBillingLogs((costs ?? []) as BillingLog[]);
      setIsLoading(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [organization?.id]);

  const resourceSummary = useMemo(() => {
    const totalUsd = billingLogs.reduce(
      (acc, log) => acc + (log.cost_usd ?? 0),
      0,
    );
    const totalChf = billingLogs.reduce(
      (acc, log) => acc + (log.cost_chf ?? 0),
      0,
    );
    const provider = process.env.NEXT_PUBLIC_AI_PRIMARY_PROVIDER ?? "unknown";

    return {
      totalUsd,
      totalChf,
      provider,
    };
  }, [billingLogs]);

  const handleExecutiveAction = async () => {
    if (!organization?.id) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    setActionStatus("Freigabe wird protokolliert...");
    await logManagementProtocol({
      userId: data.user.id,
      organizationId: organization.id,
      agentName: "Master-Manager",
      summary: "Executive approval issued.",
      details: "Owner approved the latest management decisions.",
      executiveApproval: EXECUTIVE_APPROVAL_TOKEN,
    });
    setActionStatus("Executive Freigabe protokolliert.");
    window.setTimeout(() => setActionStatus(null), 3000);
  };

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <p className="text-sm text-slate-400">
          Zugriff verweigert. Dieser Bereich ist nur für Owner/Admins sichtbar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>Executive Command Center</span>
          <span>Boardroom Seat</span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
              Registrar-Feed
            </p>
            <div className="mt-4 space-y-3">
              {isLoading ? (
                <p className="text-sm text-slate-400">Loading logs...</p>
              ) : registrarLogs.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Keine Protokolle verfügbar.
                </p>
              ) : (
                registrarLogs.map((log) => {
                  const payload = log.payload as Record<string, unknown> | null;
                  const decisions = Array.isArray(payload?.decisions)
                    ? payload?.decisions
                    : [];
                  const openTasks = Array.isArray(payload?.open_tasks)
                    ? payload?.open_tasks
                    : [];
                  const flowStatus =
                    typeof payload?.flow_status === "string"
                      ? payload?.flow_status
                      : "unknown";

                  return (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 text-xs text-slate-300"
                    >
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                        <span>Flow: {flowStatus}</span>
                        <span>{formatTimestamp(log.created_at)}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                            Entscheidungen
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {decisions.length ? (
                              decisions.map((item, index) => (
                                <li key={`decision-${index}`}>{String(item)}</li>
                              ))
                            ) : (
                              <li>Keine Entscheidungen gemeldet.</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                            Offene Aufgaben
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {openTasks.length ? (
                              openTasks.map((item, index) => (
                                <li key={`task-${index}`}>{String(item)}</li>
                              ))
                            ) : (
                              <li>Keine offenen Aufgaben.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
                Resource-Controller
              </p>
              <p className="mt-3 text-sm text-slate-300">
                Brain-Provider: {resourceSummary.provider}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                Kosten (USD): {resourceSummary.totalUsd.toFixed(2)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                Kosten (CHF): {resourceSummary.totalChf.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                Executive Action
              </p>
              <button
                className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-900 hover:bg-emerald-400"
                type="button"
                onClick={handleExecutiveAction}
              >
                Freigabe erteilen
              </button>
              {actionStatus ? (
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-emerald-200">
                  {actionStatus}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminCockpitPage;

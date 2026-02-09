/**
 * @MODULE_ID app.zasterix-vault
 * @STAGE admin
 * @DATA_INPUTS ["ip", "query"]
 * @REQUIRED_TOOLS []
 */
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/core/types/database.types";
import { VaultDashboard } from "./VaultDashboard";

export const dynamic = 'force-dynamic';

type VaultPageProps = {
  searchParams?: {
    token?: string;
  };
};

const parseIp = (value: string | null) => {
  if (!value) return "";
  return value.split(",")[0]?.trim() ?? "";
};

const buildAllowedIps = () => {
  return (process.env.VAULT_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
};

export default async function VaultPage({ searchParams }: VaultPageProps) {
  const headerList = headers();
  const ip =
    parseIp(headerList.get("x-forwarded-for")) ||
    parseIp(headerList.get("x-real-ip"));
  const allowedIps = buildAllowedIps();
  const tokenParam = searchParams?.token ?? "";
  const debugTokenMatches =
    tokenParam === process.env.VAULT_ACCESS_TOKEN ||
    tokenParam === process.env.NEXT_PUBLIC_VAULT_TOKEN ||
    tokenParam === "Zasterix-2026-Safe";
  const allowedByToken =
    Boolean(process.env.VAULT_ACCESS_TOKEN) &&
    tokenParam === process.env.VAULT_ACCESS_TOKEN;
  const allowedByIp = Boolean(ip && allowedIps.includes(ip));

  if (!allowedByToken && !allowedByIp) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-10 text-slate-100 shadow-[0_25px_60px_rgba(15,23,42,0.4)]">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-sm text-slate-400">
          Dieser Bereich ist geschützt. Bitte nutze die autorisierte URL.
        </p>
      </div>
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  const hasServerUrl = Boolean(supabaseUrl);
  const hasServerKey = Boolean(supabaseKey);

  let history: Database["public"]["Tables"]["universal_history"]["Row"][] = [];
  let serverErrorMessage: string | null = null;
  let serverErrorDetails: string | null = null;

  if (!hasServerUrl || !hasServerKey) {
    serverErrorMessage = "Supabase server credentials missing.";
    console.error("Vault server env missing:", {
      hasServerUrl,
      hasServerKey,
    });
  } else {
    const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("universal_history")
      .select("id, payload, summary_payload, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Vault server fetch failed:", error);
      serverErrorMessage = error.message;
      serverErrorDetails = [
        error.code ? `code: ${error.code}` : null,
        error.details ? `details: ${error.details}` : null,
        error.hint ? `hint: ${error.hint}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    } else {
      history = data ?? [];
    }
  }

  return (
    <VaultDashboard
      debugMode={Boolean(tokenParam && debugTokenMatches)}
      initialHistory={history}
      serverErrorMessage={serverErrorMessage}
      serverErrorDetails={serverErrorDetails}
      serverEnvStatus={{ hasUrl: hasServerUrl, hasKey: hasServerKey }}
    />
  );
}

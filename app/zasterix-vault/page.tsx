/**
 * @MODULE_ID app.zasterix-vault
 * @STAGE admin
 * @DATA_INPUTS ["ip", "query"]
 * @REQUIRED_TOOLS []
 */
import { headers } from "next/headers";
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

export default function VaultPage({ searchParams }: VaultPageProps) {
  const headerList = headers();
  const ip =
    parseIp(headerList.get("x-forwarded-for")) ||
    parseIp(headerList.get("x-real-ip"));
  const allowedIps = buildAllowedIps();
  const tokenParam = searchParams?.token ?? "";
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

  return <VaultDashboard />;
}

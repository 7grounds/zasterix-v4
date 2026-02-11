/**
 * @MODULE_ID app.admin.cockpit
 * @STAGE admin
 * @DATA_INPUTS ["agent_templates"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type OrigoAgent = {
  id: string;
  name: string;
  level: number;
  category: string | null;
  parentTemplateId: string | null;
};

const ZASTERIX_ID =
  process.env.NEXT_PUBLIC_ZASTERIX_ORGANIZATION_ID ??
  process.env.ZASTERIX_ORGANIZATION_ID ??
  "17b2f0fe-f89d-47b1-9fd4-aafe1a327388";

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const normalizeLevel = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const toOrigoAgents = (rows: unknown): OrigoAgent[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const record = asObject(row);
      const id = typeof record?.id === "string" ? record.id : null;
      const name = typeof record?.name === "string" ? record.name : null;
      if (!id || !name) return null;

      return {
        id,
        name,
        level: normalizeLevel(record?.level),
        category: typeof record?.category === "string" ? record.category : null,
        parentTemplateId:
          typeof record?.parent_template_id === "string"
            ? record.parent_template_id
            : null,
      };
    })
    .filter((agent): agent is OrigoAgent => Boolean(agent));
};

async function getZasterixAgents() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: agents, error } = await supabase
    .from("agent_templates")
    .select("*")
    .eq("organization_id", ZASTERIX_ID)
    .order("level", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden:", error);
    return [];
  }

  return toOrigoAgents(agents);
}

export default async function ManagementDashboard() {
  const agents = await getZasterixAgents();
  const l1 = agents.filter((agent) => agent.level === 1);
  const l2 = agents.filter((agent) => agent.level === 2);

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans">
      <h1 className="mb-12 text-center text-2xl font-black uppercase tracking-widest text-slate-900">
        Zasterix Management Cockpit
      </h1>

      <div className="flex flex-col items-center gap-12">
        <div className="flex flex-col items-center">
          {l1.map((agent) => (
            <AgentCard key={agent.id} agent={agent} color="bg-black text-white" />
          ))}
          <div className="h-12 w-px bg-slate-300" />
        </div>

        <div className="relative flex justify-center gap-8">
          <div className="absolute -top-6 left-0 right-0 h-px bg-slate-300" />
          {l2.map((agent) => (
            <div key={agent.id} className="flex flex-col items-center">
              <div className="h-6 w-px bg-slate-300" />
              <AgentCard agent={agent} color="border-2 border-slate-800 bg-white" />

              <div className="mt-6 space-y-2">
                {agents
                  .filter((subAgent) => subAgent.parentTemplateId === agent.id)
                  .map((subAgent) => (
                    <Link href={`/chat/${subAgent.id}`} key={subAgent.id}>
                      <div className="w-32 cursor-pointer rounded bg-slate-200 p-2 text-center text-[10px] transition-colors hover:bg-blue-500 hover:text-white">
                        {subAgent.name}
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent, color }: { agent: OrigoAgent; color: string }) {
  return (
    <Link href={`/chat/${agent.id}`}>
      <div
        className={`${color} w-56 cursor-pointer p-5 text-center shadow-lg transition-transform hover:scale-105`}
      >
        <p className="text-[9px] font-mono opacity-60">LEVEL 0{agent.level}</p>
        <h3 className="text-sm font-bold">{agent.name}</h3>
        <p className="mt-1 text-[10px] italic">{agent.category ?? "uncategorized"}</p>
        <div className="mt-3 text-[10px] underline">Chat oeffnen -&gt;</div>
      </div>
    </Link>
  );
}

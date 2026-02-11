/**
 * @MODULE_ID app.chat.agent
 * @STAGE admin
 * @DATA_INPUTS ["agent_templates"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const ZASTERIX_ID = "17b2f0fe-f89d-47b1-9fd4-aafe1a327388";

type ChatPageProps = {
  params: {
    id: string;
  };
};

type AgentRecord = {
  id: string;
  name: string;
  level: number;
  category: string | null;
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

const toAgentRecord = (value: unknown, id: string): AgentRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      id,
      name: "Unbekannter Agent",
      level: 0,
      category: "system",
    };
  }

  const record = value as Record<string, unknown>;

  return {
    id: typeof record.id === "string" ? record.id : id,
    name: typeof record.name === "string" ? record.name : "Unbekannter Agent",
    level: normalizeLevel(record.level),
    category: typeof record.category === "string" ? record.category : "system",
  };
};

async function getAgent(id: string): Promise<AgentRecord> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      id,
      name: "Unbekannter Agent",
      level: 0,
      category: "system",
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("agent_templates")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ZASTERIX_ID)
    .maybeSingle();

  if (error) {
    console.error("Fehler beim Laden:", error);
  }

  return toAgentRecord(data, id);
}

export default async function ZasterixChatPage({ params }: ChatPageProps) {
  const agent = await getAgent(params.id);
  const agentBadgeColor =
    agent.level === 1 ? "bg-white text-black" : "bg-[#00a884] text-white";

  return (
    <div className="selection:bg-[#00a884]/30 flex h-screen w-screen overflow-hidden bg-[#0b141a] font-sans text-[#e9edef]">
      <aside className="flex w-20 shrink-0 flex-col border-r border-[#222d34] bg-[#111b21] md:w-72">
        <header className="flex h-16 items-center border-b border-[#222d34] bg-[#202c33] px-6">
          <span className="text-sm font-black uppercase tracking-[0.3em] text-[#e9edef]">
            Zasterix
          </span>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 border-l-4 border-[#00a884] bg-[#2a3942] p-4">
            <div className={`h-10 w-10 shrink-0 rounded-full ${agentBadgeColor} flex items-center justify-center text-xs font-bold`}>
              L{agent.level}
            </div>
            <div className="hidden truncate md:block">
              <p className="truncate text-sm font-bold text-[#e9edef]">{agent.name}</p>
              <p className="text-[10px] uppercase tracking-tighter text-[#8696a0]">
                {agent.category}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col bg-[#0b141a]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
          }}
        />

        <header className="z-10 flex h-16 items-center justify-between border-b border-[#222d34] bg-[#202c33] px-8 shadow-lg">
          <div className="flex items-center gap-4">
            <div
              className={`h-10 w-10 rounded-full ${agentBadgeColor} flex items-center justify-center text-xs font-bold ${agent.level === 1 ? "shadow-[0_0_15px_rgba(255,255,255,0.2)]" : ""}`}
            >
              L{agent.level}
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-[#e9edef]">{agent.name}</h1>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#00a884]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8696a0]">
                  System Online
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="scrollbar-thin scrollbar-thumb-[#374045] z-10 flex flex-1 flex-col gap-6 overflow-y-auto px-[8%] py-10">
          <div className="max-w-[80%] self-start md:max-w-[65%]">
            <div className="rounded-2xl rounded-tl-none border border-[#222d34] bg-[#202c33] p-5 shadow-md">
              <p className="text-[15px] leading-relaxed text-[#e9edef]">
                Dunkelmodus fuer <strong>Zasterix Origo OS</strong> ist aktiv. Die
                Hierarchie-Ebene <strong>{agent.level}</strong> ist zur Analyse bereit.
                Wie lautet der naechste Befehl?
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase text-[#8696a0]">
                  Node: {agent.category}
                </span>
                <span className="font-mono text-[9px] text-[#8696a0]">SECURE-LINK</span>
              </div>
            </div>
          </div>

          <div className="max-w-[80%] self-end md:max-w-[65%]">
            <div className="rounded-2xl rounded-tr-none border border-[#056162] bg-[#056162] p-5 shadow-md">
              <p className="text-[15px] leading-relaxed text-[#e9edef]">
                Initialisiere das Management-Board und bereite die Kunden-Chatboxen
                vor.
              </p>
              <span className="mt-2 block text-right font-mono text-[9px] uppercase text-[#8696a0]">
                Status: Delivered
              </span>
            </div>
          </div>
        </div>

        <footer className="z-10 flex h-24 items-center gap-4 border-t border-[#222d34] bg-[#202c33] px-8 py-4">
          <div className="focus-within:border-[#00a884]/50 flex flex-1 items-center rounded-2xl border border-[#2a3942] bg-[#2a3942] px-6 py-4 transition-all">
            <input
              type="text"
              placeholder={`Nachricht an ${agent.name}...`}
              className="w-full border-none bg-transparent text-sm text-[#e9edef] outline-none placeholder-[#8696a0] focus:ring-0"
            />
          </div>
          <button
            type="button"
            className="flex items-center justify-center rounded-2xl bg-[#00a884] p-4 text-white shadow-lg transition-all hover:bg-[#008f6f] active:scale-90"
            aria-label="Nachricht senden"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
            </svg>
          </button>
        </footer>
      </main>
    </div>
  );
}

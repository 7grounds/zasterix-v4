/**
 * @MODULE_ID app.chat.agent
 * @STAGE admin
 * @DATA_INPUTS ["agent_templates"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
  const { data } = await supabase
    .from("agent_templates")
    .select("id, name, level, category")
    .eq("id", id)
    .maybeSingle();

  return toAgentRecord(data, id);
}

export default async function ZasterixChatPage({ params }: ChatPageProps) {
  const agent = await getAgent(params.id);
  const agentBadgeColor = agent.level === 1 ? "bg-black" : "bg-blue-600";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#efeae2] font-sans">
      <aside className="flex w-20 shrink-0 flex-col border-r border-gray-300 bg-white md:w-72">
        <header className="flex h-16 shrink-0 items-center border-b border-gray-300 bg-[#f0f2f5] px-4">
          <h2 className="hidden text-xs font-bold uppercase tracking-widest text-gray-700 md:block">
            Zasterix Intern
          </h2>
          <div className="mx-auto font-black text-green-600 md:hidden">Z</div>
        </header>
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="flex items-center justify-center gap-3 border-l-4 border-[#00a884] bg-[#f0f2f5] p-4 md:justify-start">
            <div
              className={`h-10 w-10 shrink-0 rounded-full ${agentBadgeColor} flex items-center justify-center text-xs font-bold text-white`}
            >
              L{agent.level}
            </div>
            <div className="hidden truncate md:block">
              <p className="truncate text-sm font-bold text-gray-800">{agent.name}</p>
              <p className="text-[10px] font-medium text-green-600">Online</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col bg-[#e5ddd5]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
          }}
        />

        <header className="z-10 flex h-16 shrink-0 items-center border-b border-gray-300 bg-[#f0f2f5] px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div
              className={`h-10 w-10 rounded-full ${agentBadgeColor} flex items-center justify-center text-xs font-bold text-white`}
            >
              L{agent.level}
            </div>
            <div>
              <h1 className="text-base font-bold leading-none text-gray-800">{agent.name}</h1>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {agent.category}
              </p>
            </div>
          </div>
        </header>

        <div className="z-10 flex flex-1 flex-col gap-4 overflow-y-auto px-[5%] py-8">
          <div className="animate-in slide-in-from-left-2 duration-300 fade-in self-start max-w-[85%] md:max-w-[70%]">
            <div className="rounded-2xl rounded-tl-none border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm leading-relaxed text-gray-800">
                System-Check abgeschlossen. Ich bin als {agent.category} (Level {agent.level})
                einsatzbereit. Wie lautet der naechste Schritt fuer die
                Zasterix-Unternehmensfuehrung?
              </p>
              <span className="mt-2 block text-right font-mono text-[10px] text-gray-400">
                12:00
              </span>
            </div>
          </div>

          <div className="animate-in slide-in-from-right-2 duration-300 fade-in self-end max-w-[85%] md:max-w-[70%]">
            <div className="rounded-2xl rounded-tr-none border border-[#c6e9af] bg-[#dcf8c6] p-4 shadow-sm">
              <p className="text-sm leading-relaxed text-gray-800">
                Analysiere die aktuelle Struktur und bereite das Meeting vor.
              </p>
              <span className="mt-2 block text-right font-mono text-[10px] text-gray-500">
                12:01
              </span>
            </div>
          </div>
        </div>

        <footer className="z-10 flex h-20 items-center gap-4 border-t border-gray-300 bg-[#f0f2f5] px-6 py-4">
          <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-inner">
            <input
              type="text"
              placeholder="Nachricht tippen..."
              className="w-full border-none bg-transparent text-sm outline-none focus:ring-0"
            />
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded-full bg-[#00a884] p-3 text-white shadow-md transition-all hover:bg-[#008f6f] active:scale-95"
            aria-label="Nachricht senden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M3.4 20.6L22 12 3.4 3.4l.9 6.8 9.7 1.8-9.7 1.8-.9 7.8z" />
            </svg>
          </button>
        </footer>
      </main>
    </div>
  );
}

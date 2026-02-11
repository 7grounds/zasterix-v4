/**
 * @MODULE_ID app.dashboard.showcase
 * @STAGE global
 * @DATA_INPUTS ["agent_templates"]
 * @REQUIRED_TOOLS ["supabase-js", "next/link"]
 */
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ZASTERIX_ID = "17b2f0fe-f89d-47b1-9fd4-aafe1a327388";

type ProductAgent = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  organizationId: string | null;
};

type Discipline = {
  name: string;
  items: ProductAgent[];
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toProductAgents = (rows: unknown): ProductAgent[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const record = asObject(row);
      if (!record) return null;
      const id = typeof record.id === "string" ? record.id : null;
      const name = typeof record.name === "string" ? record.name : null;
      if (!id || !name) return null;

      return {
        id,
        name,
        description:
          typeof record.description === "string" ? record.description : null,
        category: typeof record.category === "string" ? record.category : null,
        organizationId:
          typeof record.organization_id === "string" ? record.organization_id : null,
      };
    })
    .filter((entry): entry is ProductAgent => Boolean(entry));
};

const includesAny = (name: string, needles: string[]) => {
  const lowercase = name.toLowerCase();
  return needles.some((needle) => lowercase.includes(needle.toLowerCase()));
};

const isTeacherAgent = (agent: ProductAgent) => {
  const haystack = `${agent.name} ${agent.description ?? ""} ${agent.category ?? ""}`
    .toLowerCase()
    .replace(/[_-]/g, " ");

  return includesAny(haystack, [
    "teacher",
    "product teacher",
    "tutor",
    "coach",
    "mentor",
    "english",
    "ghostwriter",
    "python",
    "architect",
    "auditor",
    "controller",
  ]);
};

const buildDisciplines = (products: ProductAgent[]): Discipline[] => [
  {
    name: "Language & Communication",
    items: products.filter((product) =>
      includesAny(product.name, ["English", "Ghostwriter"]),
    ),
  },
  {
    name: "Technical & Coding",
    items: products.filter((product) =>
      includesAny(product.name, ["Python", "Architect"]),
    ),
  },
  {
    name: "Management & Strategy",
    items: products.filter((product) =>
      includesAny(product.name, ["Auditor", "Controller"]),
    ),
  },
  {
    name: "Specialized Teachers",
    items: products.filter(
      (product) =>
        !includesAny(product.name, ["English", "Ghostwriter"]) &&
        !includesAny(product.name, ["Python", "Architect"]) &&
        !includesAny(product.name, ["Auditor", "Controller"]),
    ),
  },
];

async function getZasterixProducts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase
    .from("agent_templates")
    .select("id, name, description, category, organization_id")
    .or(`organization_id.eq.${ZASTERIX_ID},organization_id.is.null`)
    .order("name", { ascending: true });

  if (error) {
    console.error("Fehler beim Laden:", error);
    return [];
  }

  const agents = toProductAgents(data);
  const teacherAgents = agents.filter(isTeacherAgent);
  return teacherAgents.length > 0 ? teacherAgents : agents;
}

export default async function ZasterixShowroom() {
  const products = await getZasterixProducts();
  const disciplines = buildDisciplines(products);
  const hasProducts = disciplines.some((discipline) => discipline.items.length > 0);

  return (
    <div className="min-h-screen bg-[#0b141a] p-8 text-[#e9edef] md:p-16">
      <header className="mx-auto mb-16 max-w-7xl border-b border-[#222d34] pb-8">
        <h1 className="mb-2 text-2xl font-black uppercase tracking-[0.6em]">
          Zasterix Showroom
        </h1>
        <p className="text-xs uppercase tracking-widest text-[#8696a0] opacity-60">
          High-Performance Agent Inventory
        </p>
      </header>

      <main className="mx-auto max-w-7xl space-y-20">
        {!hasProducts ? (
          <p className="rounded-2xl border border-[#222d34] bg-[#111b21] px-6 py-5 text-sm text-[#8696a0]">
            Keine Product_Teacher-Agenten gefunden.
          </p>
        ) : null}

        {disciplines.map((discipline) =>
          discipline.items.length > 0 ? (
            <section key={discipline.name}>
              <h2 className="mb-8 border-l-2 border-[#00a884] pl-4 text-[10px] font-bold uppercase tracking-[0.4em] text-[#00a884]">
                {discipline.name}
              </h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {discipline.items.map((agent) => (
                  <Link href={`/chat/${agent.id}`} key={agent.id}>
                    <div className="group cursor-pointer rounded-2xl border border-[#222d34] bg-[#111b21] p-6 shadow-lg transition-all hover:border-[#00a884] hover:shadow-[#00a884]/5">
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#202c33] font-bold text-[#00a884] transition-colors group-hover:bg-[#00a884] group-hover:text-white">
                          PROD
                        </div>
                        <span className="text-[9px] uppercase tracking-tighter text-[#54656f]">
                          ID: {agent.id.slice(0, 8)}
                        </span>
                      </div>
                      <h3 className="mb-2 text-lg font-bold transition-colors group-hover:text-[#00a884]">
                        {agent.name}
                      </h3>
                      <p className="mb-6 line-clamp-2 text-xs leading-relaxed text-[#8696a0]">
                        {agent.description ||
                          "Automatisierte Hochleistungs-Instanz fuer professionelle Anwendungen."}
                      </p>
                      <div className="flex items-center justify-between border-t border-[#222d34] pt-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#54656f]">
                          Ready to Deploy
                        </span>
                        <span className="text-xs font-bold text-[#00a884] transition-transform group-hover:translate-x-1">
                          Order -&gt;
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null,
        )}
      </main>
    </div>
  );
}

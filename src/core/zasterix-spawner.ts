/**
 * @MODULE_ID core.zasterix-spawner
 * @STAGE admin
 * @DATA_INPUTS ["l1_insights", "shared_logic", "agent_templates"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/core/types/database.types";

const DEFAULT_SHARED_LOGIC_KEY = "origo-minimalist-standard";
const ZASTERIX_PRODUCER = "Zasterix-L3";

type SharedLogicRow = Database["public"]["Tables"]["shared_logic"]["Row"];
type AgentTemplateRow = Database["public"]["Tables"]["agent_templates"]["Row"];

export type SpawnAgentInput = {
  organizationId?: string | null;
  discipline?: string;
  category?: string | null;
  agentType?: string;
  icon?: string | null;
  l1Insights?: string[];
};

export type SpawnAgentResult = {
  agent: AgentTemplateRow;
  sharedLogic: SharedLogicRow;
  insightsUsed: string[];
};

type RoadmapStep = {
  id: number;
  title: string;
  type: string;
  status: "pending";
  content: null;
};

const DEFAULT_SHARED_LOGIC_PAYLOAD: Record<string, Json> = {
  standard: "origo-minimalist",
  standards: [
    "Code minimal halten und unnötige Wrapper vermeiden.",
    "Data-driven UI statt hardcodierter Schrittketten.",
    "Antworten konkret, umsetzbar und compliance-bewusst halten.",
    "Bei unklaren Inputs zuerst fehlende Kernfakten abfragen.",
  ],
  runtime: {
    enforce_short_feedback_loop: true,
    prefer_structured_outputs: true,
  },
};

const normalizeInsight = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim();

const toInsightList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? normalizeInsight(entry) : ""))
    .filter((entry) => entry.length > 0);
};

const extractInsightFromPayload = (payload: unknown): string[] => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const record = payload as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  const isL1Source = /(l1|feedback|user|survey|review|insight)/i.test(type);
  if (!isL1Source) {
    return [];
  }

  const candidates = [
    record.feedback,
    record.user_feedback,
    record.summary,
    record.message,
    record.user_message,
    record.request,
    record.insight,
  ];

  return candidates
    .map((entry) => (typeof entry === "string" ? normalizeInsight(entry) : ""))
    .filter((entry) => entry.length > 0);
};

const buildRoadmap = (discipline: string, insights: string[]): RoadmapStep[] => {
  const primaryFocus = insights[0] ?? `${discipline} Grundlagen`;
  const secondaryFocus = insights[1] ?? `${discipline} Praxis`;

  return [
    {
      id: 1,
      title: `Bedarfsanalyse: ${primaryFocus}`,
      type: "analysis",
      status: "pending",
      content: null,
    },
    {
      id: 2,
      title: `Fundament aufbauen: ${discipline} Kernprinzipien`,
      type: "foundation",
      status: "pending",
      content: null,
    },
    {
      id: 3,
      title: `Anwendungsszenario: ${secondaryFocus}`,
      type: "application",
      status: "pending",
      content: null,
    },
    {
      id: 4,
      title: "Qualitäts- und Risikoabsicherung",
      type: "quality",
      status: "pending",
      content: null,
    },
    {
      id: 5,
      title: "Operationalisierung als wiederholbarer Workflow",
      type: "operations",
      status: "pending",
      content: null,
    },
  ];
};

const toSearchKeywords = (value: string) =>
  Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9äöüß\s-]/gi, " ")
        .split(/\s+/g)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 2),
    ),
  );

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are missing.");
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey);
};

const ensureSharedLogic = async (
  organizationId: string | null,
): Promise<{ client: ReturnType<typeof getSupabaseAdmin>; row: SharedLogicRow }> => {
  const admin = getSupabaseAdmin();

  const loadExisting = async (orgId: string | null) => {
    let query = admin
      .from("shared_logic")
      .select(
        "id, organization_id, logic_key, logic_payload, is_active, created_at, updated_at",
      )
      .eq("logic_key", DEFAULT_SHARED_LOGIC_KEY)
      .eq("is_active", true);

    query = orgId
      ? query.eq("organization_id", orgId)
      : query.is("organization_id", null);

    return query.maybeSingle();
  };

  const { data: orgScoped } = await loadExisting(organizationId);
  if (orgScoped) {
    return { client: admin, row: orgScoped as SharedLogicRow };
  }

  const { data: globalScoped } = await loadExisting(null);
  if (globalScoped) {
    return { client: admin, row: globalScoped as SharedLogicRow };
  }

  const { data: inserted, error: insertError } = await admin
    .from("shared_logic")
    .insert({
      organization_id: organizationId,
      logic_key: DEFAULT_SHARED_LOGIC_KEY,
      logic_payload: DEFAULT_SHARED_LOGIC_PAYLOAD,
      is_active: true,
    })
    .select(
      "id, organization_id, logic_key, logic_payload, is_active, created_at, updated_at",
    )
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Could not initialize shared logic.");
  }

  return { client: admin, row: inserted as SharedLogicRow };
};

const loadL1Insights = async ({
  admin,
  organizationId,
  providedInsights,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  organizationId: string | null;
  providedInsights: string[];
}) => {
  if (providedInsights.length > 0) {
    return providedInsights;
  }

  let historyQuery = admin
    .from("universal_history")
    .select("payload, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  historyQuery = organizationId
    ? historyQuery.eq("organization_id", organizationId)
    : historyQuery.is("organization_id", null);

  const { data: historyRows, error: historyError } = await historyQuery;
  if (historyError || !historyRows) {
    return [];
  }

  const extracted = historyRows.flatMap((row) =>
    extractInsightFromPayload(row.payload),
  );
  return Array.from(new Set(extracted)).slice(0, 10);
};

const buildSystemPrompt = ({
  agentName,
  discipline,
  sharedLogic,
  insights,
}: {
  agentName: string;
  discipline: string;
  sharedLogic: SharedLogicRow;
  insights: string[];
}) => {
  const sharedPayload =
    sharedLogic.logic_payload && typeof sharedLogic.logic_payload === "object"
      ? (sharedLogic.logic_payload as Record<string, unknown>)
      : {};
  const standards = Array.isArray(sharedPayload.standards)
    ? sharedPayload.standards
        .map((entry) => (typeof entry === "string" ? entry : ""))
        .filter((entry) => entry.length > 0)
    : [];
  const insightLines = insights.length
    ? insights.map((entry) => `- ${entry}`).join("\n")
    : "- Keine direkten L1-Insights vorhanden. Stelle zuerst fokussierte Rueckfragen.";
  const standardsLines = standards.length
    ? standards.map((entry) => `- ${entry}`).join("\n")
    : "- Halte Antworten minimalistisch, data-driven und production-ready.";

  return [
    `Du bist ${agentName}, ein von ${ZASTERIX_PRODUCER} erzeugter Spezial-Agent.`,
    `Disziplin: ${discipline}.`,
    "Ziel: Liefere praezise, umsetzbare Antworten auf Basis von Nutzer-Insights.",
    "",
    "L1-INSIGHTS (Nutzerfeedback):",
    insightLines,
    "",
    `SHARED_LOGIC (${sharedLogic.logic_key}) - VERBINDLICHE STANDARDS:`,
    standardsLines,
    "",
    "Arbeitsmodus:",
    "- Arbeite mit klaren Schritten und nenne konkrete Handlungsempfehlungen.",
    "- Wenn Daten fehlen, stelle kurze und praezise Rueckfragen.",
    "- Erklaere nur das Notwendige und vermeide Redundanz.",
  ].join("\n");
};

export const spawnAgent = async (
  input: SpawnAgentInput,
): Promise<SpawnAgentResult> => {
  const organizationId = input.organizationId ?? null;
  const discipline = (input.discipline || "General").trim();
  const requestedType = (input.agentType || `${discipline} Synth Agent`).trim();
  const providedInsights = Array.from(new Set(toInsightList(input.l1Insights)));

  const { client: admin, row: sharedLogic } = await ensureSharedLogic(organizationId);
  const insights = await loadL1Insights({
    admin,
    organizationId,
    providedInsights,
  });
  const agentName = `L3 ${requestedType}`;
  const description =
    `Automatisch durch ${ZASTERIX_PRODUCER} erzeugter Agent für ${discipline} auf Basis von L1-Nutzerfeedback.`;
  const roadmap = buildRoadmap(discipline, insights);
  const systemPrompt = buildSystemPrompt({
    agentName,
    discipline,
    sharedLogic,
    insights,
  });
  const metadata: Record<string, Json> = {
    producer: ZASTERIX_PRODUCER,
    source_level: "L1",
    discipline,
    insight_count: insights.length,
    shared_logic_key: sharedLogic.logic_key,
    generated_at: new Date().toISOString(),
  };
  const searchKeywords = toSearchKeywords(
    [agentName, discipline, input.category, ...insights].filter(Boolean).join(" "),
  );

  const { data, error } = await admin
    .from("agent_templates")
    .insert({
      name: agentName,
      description,
      system_prompt: systemPrompt,
      organization_id: organizationId,
      category: input.category ?? "Generated",
      icon: input.icon ?? "🏭",
      search_keywords: searchKeywords,
      course_roadmap: roadmap as unknown as Json,
      shared_logic_id: sharedLogic.id,
      spawn_metadata: metadata,
      produced_by: ZASTERIX_PRODUCER,
    })
    .select(
      "id, name, description, system_prompt, organization_id, category, icon, search_keywords, created_at, course_roadmap, shared_logic_id, spawn_metadata, produced_by",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not spawn new agent template.");
  }

  return {
    agent: data as AgentTemplateRow,
    sharedLogic,
    insightsUsed: insights,
  };
};

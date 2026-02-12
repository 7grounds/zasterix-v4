/**
 * @MODULE_ID core.discussion-engine
 * @STAGE discussion
 * @DATA_INPUTS ["projects", "agent_templates", "agent_blueprints", "universal_history"]
 * @REQUIRED_TOOLS ["ai-sdk", "supabase-js"]
 */
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

type DiscussionProject = {
  id: string;
  organization_id: string | null;
  name: string;
  type: string;
  status: string;
  metadata: unknown;
  current_discussion_step: number;
};

type DiscussionAgent = {
  id: string;
  name: string;
  level: number | null;
  system_prompt: string;
  parent_template_id: string | null;
  ai_model_config: unknown;
  organization_id: string | null;
};

type DiscussionEntry = {
  id: string;
  type: "discussion_turn" | "discussion_summary";
  speakerKey: string;
  speakerName: string;
  speakerRole: "user" | "manager" | "expert";
  content: string;
  createdAt: string | null;
  agentTemplateId: string | null;
  level: number | null;
  keywords: string[];
};

type DiscussionState = {
  project: DiscussionProject;
  entries: DiscussionEntry[];
  counts: Record<string, number>;
  speakerOrder: string[];
  nextSpeaker: string | null;
};

type AdvanceDiscussionInput = {
  projectId: string;
  message: string;
  userId: string;
  organizationId?: string | null;
};

type DiscussionModelConfig = {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

const MAX_SPEECHES_PER_PARTICIPANT = 2;
const MAX_AGENT_LINES = 3;
const DISCUSSION_HISTORY_WINDOW = 10;
const DEFAULT_SPEAKER_ORDER = [
  "manager_l3",
  "hotel_expert_l2",
  "guide_expert_l2",
  "tourismus_expert_l2",
  "user",
];
const DEFAULT_AGENT_NAME_MAP: Record<string, string[]> = {
  manager_l3: ["Manager L3", "Zasterix Manager (L3)"],
  hotel_expert_l2: ["Hotel Expert L2", "Hotel-Hub-Integrator (L2)"],
  guide_expert_l2: ["Guide Expert L2", "Experience Curator BO (L2)"],
  tourism_expert_l2: ["Tourismus Expert L2", "Tourism Expert L2"],
  tourism_expert: ["Tourismus Expert L2", "Tourism Expert L2"],
  tourismus_expert_l2: ["Tourismus Expert L2", "Tourism Expert L2"],
};
const GROQ_FALLBACK_CONFIG: DiscussionModelConfig = {
  provider: "groq",
  model: "llama-3.1-8b-instant",
  temperature: 0.2,
};
const SPEAKER_DEFAULT_KEYWORDS: Record<string, string[]> = {
  hotel_expert_l2: ["b2b-hospitality", "occupancy-yield"],
  guide_expert_l2: ["alpin-authenticity", "guest-journey"],
  tourismus_expert_l2: ["destination-positioning", "demand-orchestration"],
  tourism_expert_l2: ["destination-positioning", "demand-orchestration"],
};
const TACTICAL_KEYWORD_PATTERNS: Array<{ keyword: string; pattern: RegExp }> = [
  { keyword: "alpin-authenticity", pattern: /\balpin|alp(?:e|in)|authent/i },
  { keyword: "b2b-hospitality", pattern: /\bb2b|hospitality|hotelpartner|vertriebspartner/i },
  { keyword: "destination-positioning", pattern: /\bdestination|positionierung|markenkern/i },
  { keyword: "guest-journey", pattern: /\bguest|gastreise|customer\s*journey|erlebniskette/i },
  { keyword: "demand-orchestration", pattern: /\bnachfrage|demand|saisonsteuerung|orchestr/i },
  { keyword: "pricing-leverage", pattern: /\bpricing|preishebel|yield|rate/i },
];
const KEYWORD_STOPWORDS = new Set([
  "und",
  "oder",
  "aber",
  "dass",
  "weil",
  "fuer",
  "fuer",
  "eine",
  "einer",
  "eines",
  "einem",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "mit",
  "von",
  "auf",
  "bei",
  "als",
  "nicht",
  "mehr",
  "noch",
  "sind",
  "ist",
  "wir",
  "sie",
  "man",
  "auch",
  "dann",
]);

const openaiFactory = process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const groqFactory = process.env.GROQ_API_KEY
  ? createGroq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const asObject = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeSpeakerKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

const parseModelConfig = (value: unknown): DiscussionModelConfig | null => {
  const record = asObject(value);
  if (!record) {
    return null;
  }

  const provider = toNonEmptyString(record.provider);
  const model = toNonEmptyString(record.model);
  if (!provider || !model) {
    return null;
  }

  const readNumber = (entry: unknown) => {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return entry;
    }
    if (typeof entry === "string") {
      const parsed = Number(entry);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };

  const temperature = readNumber(record.temperature);
  const maxTokens = readNumber(record.maxTokens) ?? readNumber(record.max_tokens);
  const topP = readNumber(record.topP) ?? readNumber(record.top_p);

  return {
    provider,
    model,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    ...(topP !== undefined ? { topP } : {}),
  };
};

const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials fehlen.");
  }
  return createClient(supabaseUrl, serviceRoleKey);
};

const resolveRules = (metadata: unknown): string[] => {
  const record = asObject(metadata);
  if (!record) {
    return [];
  }

  if (typeof record.rules === "string") {
    return record.rules
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  if (Array.isArray(record.rules)) {
    return record.rules
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const resolveSpeakerOrder = (metadata: unknown): string[] => {
  const record = asObject(metadata);
  const fromMetadata = Array.isArray(record?.speaker_order)
    ? record.speaker_order
        .map((entry) => (typeof entry === "string" ? normalizeSpeakerKey(entry) : ""))
        .filter((entry) => entry.length > 0)
    : [];

  const baseOrder = fromMetadata.length > 0 ? fromMetadata : DEFAULT_SPEAKER_ORDER;
  const deduped = Array.from(new Set(baseOrder));
  if (!deduped.includes("user")) {
    deduped.push("user");
  }
  if (!deduped.includes("manager_l3")) {
    deduped.unshift("manager_l3");
  }
  return deduped;
};

const resolveAgentNameCandidates = (metadata: unknown, speakerKey: string) => {
  const record = asObject(metadata);
  const mappedNames = asObject(record?.agent_names);
  const preferredName =
    mappedNames && typeof mappedNames[speakerKey] === "string"
      ? toNonEmptyString(mappedNames[speakerKey])
      : null;
  const defaults = DEFAULT_AGENT_NAME_MAP[speakerKey] ?? [];

  return Array.from(new Set([preferredName, ...defaults].filter(Boolean))) as string[];
};

const normalizeStep = (step: number, orderLength: number) => {
  if (orderLength <= 0) return 0;
  const safe = Number.isFinite(step) ? step : 0;
  const rounded = Math.floor(safe);
  return ((rounded % orderLength) + orderLength) % orderLength;
};

const enforceThreeLines = (value: string) => {
  const lines = value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return "Kurzpunkt folgt nach naechster Runde.";
  }
  return lines.slice(0, MAX_AGENT_LINES).join("\n");
};

const toDiscussionEntries = (rows: Array<Record<string, unknown>>): DiscussionEntry[] =>
  rows
    .map((row) => {
      const payload = asObject(row.payload);
      if (!payload) {
        return null;
      }

      const type = toNonEmptyString(payload.type);
      if (type !== "discussion_turn" && type !== "discussion_summary") {
        return null;
      }

      const speakerKey = toNonEmptyString(payload.speaker_key) ?? "unknown";
      const speakerName = toNonEmptyString(payload.speaker_name) ?? speakerKey;
      const content = toNonEmptyString(payload.content) ?? "";
      const speakerRole =
        payload.speaker_role === "manager" || payload.speaker_role === "expert"
          ? payload.speaker_role
          : "user";
      const keywords = Array.isArray(payload.keywords)
        ? payload.keywords
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter((entry) => entry.length > 0)
        : [];
      const level =
        typeof payload.level === "number" && Number.isFinite(payload.level)
          ? payload.level
          : null;

      return {
        id:
          typeof row.id === "string"
            ? row.id
            : `entry-${Date.now().toString(36)}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
        type,
        speakerKey,
        speakerName,
        speakerRole,
        content,
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
        agentTemplateId:
          typeof payload.agent_template_id === "string" ? payload.agent_template_id : null,
        level,
        keywords,
      } satisfies DiscussionEntry;
    })
    .filter((entry): entry is DiscussionEntry => Boolean(entry));

const buildSpeechCounts = (entries: DiscussionEntry[], participantKeys: string[]) => {
  const base = participantKeys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  for (const entry of entries) {
    if (entry.type !== "discussion_turn") {
      continue;
    }
    base[entry.speakerKey] = (base[entry.speakerKey] ?? 0) + 1;
  }

  return base;
};

const findNextEligibleSpeaker = ({
  speakerOrder,
  startIndex,
  counts,
}: {
  speakerOrder: string[];
  startIndex: number;
  counts: Record<string, number>;
}) => {
  if (speakerOrder.length === 0) {
    return null;
  }

  for (let offset = 0; offset < speakerOrder.length; offset += 1) {
    const index = (startIndex + offset) % speakerOrder.length;
    const speakerKey = speakerOrder[index];
    const currentCount = counts[speakerKey] ?? 0;
    if (currentCount < MAX_SPEECHES_PER_PARTICIPANT) {
      return { index, speakerKey };
    }
  }

  return null;
};

const allParticipantsCompleted = (
  counts: Record<string, number>,
  participantKeys: string[],
) =>
  participantKeys.every(
    (speakerKey) => (counts[speakerKey] ?? 0) >= MAX_SPEECHES_PER_PARTICIPANT,
  );

const normalizeKeyword = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);

const extractTacticalKeywords = (speakerKey: string, content: string): string[] => {
  const normalizedContent = content.toLowerCase();

  const matched = TACTICAL_KEYWORD_PATTERNS.flatMap((entry) =>
    entry.pattern.test(normalizedContent) ? [entry.keyword] : [],
  );

  const tokenKeywords = Array.from(
    new Set(
      normalizedContent
        .replace(/[^a-z0-9\s-]/gi, " ")
        .split(/\s+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4 && !KEYWORD_STOPWORDS.has(token))
        .map((token) => normalizeKeyword(token))
        .filter((token) => token.length >= 4),
    ),
  ).slice(0, 3);

  const defaults = SPEAKER_DEFAULT_KEYWORDS[speakerKey] ?? ["operations-focus", "guest-value"];

  return Array.from(new Set([...matched, ...tokenKeywords, ...defaults])).slice(0, 3);
};

const buildDiscussionContext = (entries: DiscussionEntry[]) =>
  entries
    .slice(-DISCUSSION_HISTORY_WINDOW)
    .map((entry) => `${entry.speakerName}: ${entry.content}`)
    .join("\n");

const resolveModelFactory = (config: DiscussionModelConfig) => {
  const provider = config.provider.toLowerCase();
  if (provider === "groq") {
    if (!groqFactory) {
      throw new Error("GROQ_API_KEY fehlt.");
    }
    return groqFactory(config.model);
  }
  if (provider === "openai") {
    if (!openaiFactory) {
      throw new Error("OPENAI_API_KEY fehlt.");
    }
    return openaiFactory(config.model);
  }
  if (!groqFactory) {
    throw new Error(`Provider nicht verfuegbar: ${config.provider}`);
  }
  return groqFactory(GROQ_FALLBACK_CONFIG.model);
};

const resolveSpeakerModelConfig = (speaker: DiscussionAgent): DiscussionModelConfig => {
  if (speaker.level === 2) {
    return GROQ_FALLBACK_CONFIG;
  }
  return parseModelConfig(speaker.ai_model_config) ?? GROQ_FALLBACK_CONFIG;
};

const generateSpeakerContribution = async ({
  speakerKey,
  speaker,
  rules,
  speakerOrder,
  entries,
  openingRound,
}: {
  speakerKey: string;
  speaker: DiscussionAgent;
  rules: string[];
  speakerOrder: string[];
  entries: DiscussionEntry[];
  openingRound: boolean;
}) => {
  const modelConfig = resolveSpeakerModelConfig(speaker);
  const model = resolveModelFactory(modelConfig);
  const discussionContext = buildDiscussionContext(entries);

  const instruction = [
    speaker.system_prompt,
    "Du bist in einer moderierten Diskussionsrunde.",
    rules.length > 0
      ? `Regeln:\n${rules.map((rule) => `- ${rule}`).join("\n")}`
      : "Regeln: Halte dich an kurze, taktische Aussagen.",
    `Sprecherreihenfolge: ${speakerOrder.join(" -> ")}`,
    openingRound && speakerKey === "manager_l3"
      ? "Du eroeffnest jetzt die Runde auf Basis der Regeln."
      : "Liefere den naechsten taktischen Beitrag.",
    "Antwortvorgabe: maximal 3 Zeilen, keine Einleitung, direkt umsetzbar.",
  ].join("\n\n");

  const { text } = await generateText({
    model,
    temperature: modelConfig.temperature ?? 0.2,
    ...(modelConfig.maxTokens !== undefined ? { maxTokens: modelConfig.maxTokens } : {}),
    ...(modelConfig.topP !== undefined ? { topP: modelConfig.topP } : {}),
    messages: [
      { role: "system", content: instruction },
      {
        role: "user",
        content:
          discussionContext.length > 0
            ? `Diskussionsverlauf:\n${discussionContext}\n\nDein Beitrag jetzt.`
            : "Starte den Beitrag jetzt.",
      },
    ],
  });

  return enforceThreeLines(text ?? "");
};

const generateManagerSummary = async ({
  manager,
  entries,
  rules,
}: {
  manager: DiscussionAgent;
  entries: DiscussionEntry[];
  rules: string[];
}) => {
  const modelConfig = resolveSpeakerModelConfig(manager);
  const model = resolveModelFactory(modelConfig);
  const context = buildDiscussionContext(entries);
  const systemPrompt = [
    manager.system_prompt,
    "Erstelle eine kurze Abschlusszusammenfassung fuer die Diskussion.",
    "Maximal 3 Zeilen, klar, entscheidungsorientiert.",
    rules.length > 0 ? `Regeln:\n${rules.map((rule) => `- ${rule}`).join("\n")}` : "",
  ]
    .filter((entry) => entry.length > 0)
    .join("\n\n");

  const { text } = await generateText({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Diskussionsverlauf:\n${context}\n\nGib jetzt die Abschlusszusammenfassung.`,
      },
    ],
  });

  return enforceThreeLines(text ?? "Zusammenfassung folgt.");
};

const upsertBlueprintKeywords = async ({
  supabase,
  blueprintId,
  keywords,
}: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  blueprintId: string;
  keywords: string[];
}) => {
  if (keywords.length === 0) {
    return [] as string[];
  }

  const { data: blueprintRow, error: loadError } = await supabase
    .from("agent_blueprints")
    .select("logic_template")
    .eq("id", blueprintId)
    .maybeSingle();

  if (loadError) {
    console.error("Blueprint keyword load error:", loadError);
    return [];
  }

  const logicTemplate = asObject(blueprintRow?.logic_template) ?? {};
  const existing = Array.isArray(logicTemplate.differentiation_keywords)
    ? logicTemplate.differentiation_keywords
        .map((entry) => (typeof entry === "string" ? normalizeKeyword(entry) : ""))
        .filter((entry) => entry.length > 0)
    : [];
  const merged = Array.from(
    new Set([...existing, ...keywords.map((entry) => normalizeKeyword(entry))]),
  ).filter((entry) => entry.length > 0);

  const { error: rpcError } = await supabase.rpc(
    "update_agent_blueprint_differentiation_keywords",
    {
      p_keywords: merged,
      p_blueprint_id: blueprintId,
    },
  );

  if (!rpcError) {
    return merged;
  }

  const { error: fallbackError } = await supabase
    .from("agent_blueprints")
    .update({
      logic_template: {
        ...logicTemplate,
        differentiation_keywords: merged,
      },
    })
    .eq("id", blueprintId);

  if (fallbackError) {
    console.error("Blueprint keyword update fallback error:", fallbackError);
    return existing;
  }

  return merged;
};

const saveDiscussionEntry = async ({
  supabase,
  projectId,
  userId,
  organizationId,
  payload,
}: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  projectId: string;
  userId: string;
  organizationId: string | null;
  payload: JsonRecord;
}) => {
  const { data, error } = await supabase
    .from("universal_history")
    .insert({
      user_id: userId,
      organization_id: organizationId,
      payload: {
        ...payload,
        project_id: projectId,
      },
      created_at: new Date().toISOString(),
    })
    .select("id, payload, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Konnte Diskussionseintrag nicht speichern.");
  }

  return data as Record<string, unknown>;
};

const loadProject = async (supabase: ReturnType<typeof createSupabaseAdmin>, projectId: string) => {
  const { data, error } = await supabase
    .from("projects")
    .select("id, organization_id, name, type, status, metadata, current_discussion_step")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Diskussionsprojekt nicht gefunden.");
  }

  return data as DiscussionProject;
};

const loadDiscussionHistory = async (
  supabase: ReturnType<typeof createSupabaseAdmin>,
  projectId: string,
) => {
  const { data, error } = await supabase
    .from("universal_history")
    .select("id, payload, created_at")
    .eq("payload->>project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return toDiscussionEntries((data ?? []) as Array<Record<string, unknown>>);
};

const loadDiscussionAgents = async ({
  supabase,
  project,
  speakerOrder,
}: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  project: DiscussionProject;
  speakerOrder: string[];
}) => {
  const agentKeys = speakerOrder.filter((speakerKey) => speakerKey !== "user");
  const uniqueAgentKeys = Array.from(new Set(agentKeys));
  const allCandidateNames = Array.from(
    new Set(
      uniqueAgentKeys.flatMap((speakerKey) =>
        resolveAgentNameCandidates(project.metadata, speakerKey),
      ),
    ),
  );

  if (allCandidateNames.length === 0) {
    throw new Error("Keine Agentenbezeichner in den Projektmetadaten gefunden.");
  }

  let query = supabase
    .from("agent_templates")
    .select("id, name, level, system_prompt, parent_template_id, ai_model_config, organization_id")
    .in("name", allCandidateNames);

  if (project.organization_id) {
    query = query.or(`organization_id.eq.${project.organization_id},organization_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as DiscussionAgent[]).slice();
  const byKey = uniqueAgentKeys.reduce<Record<string, DiscussionAgent | null>>(
    (accumulator, speakerKey) => {
      const candidates = resolveAgentNameCandidates(project.metadata, speakerKey);
      const preferred = candidates
        .flatMap((candidate) =>
          rows.filter((row) => row.name === candidate).sort((left, right) => {
            const leftOrgScore = left.organization_id === project.organization_id ? 1 : 0;
            const rightOrgScore = right.organization_id === project.organization_id ? 1 : 0;
            return rightOrgScore - leftOrgScore;
          }),
        )
        .find(Boolean);
      accumulator[speakerKey] = preferred ?? null;
      return accumulator;
    },
    {},
  );

  const missing = uniqueAgentKeys.filter((speakerKey) => !byKey[speakerKey]);
  if (missing.length > 0) {
    throw new Error(`Diskussionsagenten fehlen: ${missing.join(", ")}`);
  }

  return byKey as Record<string, DiscussionAgent>;
};

const upsertProjectState = async ({
  supabase,
  projectId,
  step,
  status,
}: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  projectId: string;
  step: number;
  status: string;
}) => {
  const { error } = await supabase
    .from("projects")
    .update({
      current_discussion_step: step,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }
};

export const getDiscussionState = async (projectId: string): Promise<DiscussionState> => {
  const supabase = createSupabaseAdmin();
  const project = await loadProject(supabase, projectId);
  const speakerOrder = resolveSpeakerOrder(project.metadata);
  const entries = await loadDiscussionHistory(supabase, projectId);
  const counts = buildSpeechCounts(entries, speakerOrder);
  const nextSpeakerData = findNextEligibleSpeaker({
    speakerOrder,
    startIndex: normalizeStep(project.current_discussion_step, speakerOrder.length),
    counts,
  });

  return {
    project,
    entries,
    counts,
    speakerOrder,
    nextSpeaker: nextSpeakerData?.speakerKey ?? null,
  };
};

export const advanceDiscussion = async (
  input: AdvanceDiscussionInput,
): Promise<DiscussionState> => {
  const supabase = createSupabaseAdmin();
  const project = await loadProject(supabase, input.projectId);
  if (project.type !== "discussion") {
    throw new Error("Projekt ist kein Diskussionstyp.");
  }

  const speakerOrder = resolveSpeakerOrder(project.metadata);
  const discussionAgents = await loadDiscussionAgents({
    supabase,
    project,
    speakerOrder,
  });
  let entries = await loadDiscussionHistory(supabase, input.projectId);
  const counts = buildSpeechCounts(entries, speakerOrder);
  const participantKeys = Array.from(new Set(speakerOrder));

  if (project.status === "completed") {
    return {
      project,
      entries,
      counts,
      speakerOrder,
      nextSpeaker: null,
    };
  }

  if ((counts.user ?? 0) >= MAX_SPEECHES_PER_PARTICIPANT) {
    throw new Error("Du hast dein 2-Beitraege-Limit fuer diese Runde erreicht.");
  }

  const userContent = enforceThreeLines(input.message);
  const savedUserEntry = await saveDiscussionEntry({
    supabase,
    projectId: input.projectId,
    userId: input.userId,
    organizationId: input.organizationId ?? project.organization_id,
    payload: {
      type: "discussion_turn",
      speaker_key: "user",
      speaker_name: "User",
      speaker_role: "user",
      content: userContent,
      level: 0,
      keywords: [],
    },
  });
  entries = [...entries, ...toDiscussionEntries([savedUserEntry])];
  counts.user = (counts.user ?? 0) + 1;

  const rules = resolveRules(project.metadata);
  const managerKey = speakerOrder.includes("manager_l3")
    ? "manager_l3"
    : speakerOrder.find((speakerKey) => speakerKey !== "user") ?? "manager_l3";
  const managerAlreadySpoke = (counts[managerKey] ?? 0) > 0;
  const managerIndex = speakerOrder.indexOf(managerKey);
  const userIndex = speakerOrder.indexOf("user");

  let nextStepIndex = normalizeStep(project.current_discussion_step, speakerOrder.length);
  if (!managerAlreadySpoke && managerIndex >= 0) {
    nextStepIndex = managerIndex;
  } else if (userIndex >= 0) {
    nextStepIndex = (userIndex + 1) % speakerOrder.length;
  }

  let guard = 0;
  while (guard < 20) {
    guard += 1;

    if (allParticipantsCompleted(counts, participantKeys)) {
      break;
    }

    const nextSpeaker = findNextEligibleSpeaker({
      speakerOrder,
      startIndex: nextStepIndex,
      counts,
    });

    if (!nextSpeaker) {
      break;
    }

    if (nextSpeaker.speakerKey === "user") {
      nextStepIndex = nextSpeaker.index;
      break;
    }

    const speaker = discussionAgents[nextSpeaker.speakerKey];
    if (!speaker) {
      nextStepIndex = (nextSpeaker.index + 1) % speakerOrder.length;
      continue;
    }

    const contribution = await generateSpeakerContribution({
      speakerKey: nextSpeaker.speakerKey,
      speaker,
      rules,
      speakerOrder,
      entries,
      openingRound: (counts[nextSpeaker.speakerKey] ?? 0) === 0,
    });

    const isExpert = (speaker.level ?? 0) === 2;
    const extractedKeywords = isExpert
      ? extractTacticalKeywords(nextSpeaker.speakerKey, contribution)
      : [];
    const persistedKeywords =
      isExpert && speaker.parent_template_id
        ? await upsertBlueprintKeywords({
            supabase,
            blueprintId: speaker.parent_template_id,
            keywords: extractedKeywords,
          })
        : [];

    const savedEntry = await saveDiscussionEntry({
      supabase,
      projectId: input.projectId,
      userId: input.userId,
      organizationId: input.organizationId ?? project.organization_id,
      payload: {
        type: "discussion_turn",
        speaker_key: nextSpeaker.speakerKey,
        speaker_name: speaker.name,
        speaker_role: (speaker.level ?? 0) >= 3 ? "manager" : "expert",
        agent_template_id: speaker.id,
        level: speaker.level ?? null,
        keywords: persistedKeywords,
        content: contribution,
      },
    });

    entries = [...entries, ...toDiscussionEntries([savedEntry])];
    counts[nextSpeaker.speakerKey] = (counts[nextSpeaker.speakerKey] ?? 0) + 1;
    nextStepIndex = (nextSpeaker.index + 1) % speakerOrder.length;
  }

  let nextStatus = "active";
  if (allParticipantsCompleted(counts, participantKeys)) {
    const manager = discussionAgents[managerKey];
    if (manager) {
      const summary = await generateManagerSummary({
        manager,
        entries,
        rules,
      });

      const savedSummary = await saveDiscussionEntry({
        supabase,
        projectId: input.projectId,
        userId: input.userId,
        organizationId: input.organizationId ?? project.organization_id,
        payload: {
          type: "discussion_summary",
          speaker_key: managerKey,
          speaker_name: manager.name,
          speaker_role: "manager",
          agent_template_id: manager.id,
          level: manager.level ?? null,
          keywords: [],
          content: summary,
        },
      });

      entries = [...entries, ...toDiscussionEntries([savedSummary])];
    }
    nextStatus = "completed";
    nextStepIndex = 0;
  }

  await upsertProjectState({
    supabase,
    projectId: input.projectId,
    step: nextStepIndex,
    status: nextStatus,
  });

  const updatedProject = await loadProject(supabase, input.projectId);
  const nextSpeakerData =
    nextStatus === "completed"
      ? null
      : findNextEligibleSpeaker({
          speakerOrder,
          startIndex: nextStepIndex,
          counts,
        });

  return {
    project: updatedProject,
    entries,
    counts,
    speakerOrder,
    nextSpeaker: nextSpeakerData?.speakerKey ?? null,
  };
};

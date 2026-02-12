/**
 * @MODULE_ID app.api.chat
 * @STAGE admin
 * @DATA_INPUTS ["message", "agentId", "systemPrompt", "history", "hiddenInstruction", "stream", "autoFillStep", "roadmapSnapshot", "aiModelConfig", "validationLibrary", "userId", "organizationId"]
 * @REQUIRED_TOOLS ["ai-sdk", "supabase-js"]
 */
import { NextResponse } from "next/server";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createClient } from "@supabase/supabase-js";

const openaiFactory = process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const groqFactory = process.env.GROQ_API_KEY
  ? createGroq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

type CourseStep = {
  id: number | string;
  title: string;
  status: "pending" | "completed" | "in_progress" | string;
  type?: string;
  content?: string | null;
};

type ChatHistoryEntry = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AutoFillStep = {
  id: number | string;
  title: string;
  type?: string;
  discipline?: string;
};

type AiModelConfig = {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

const GROQ_FALLBACK_MODEL_CONFIG: AiModelConfig = {
  provider: "groq",
  model: "llama-3.1-8b-instant",
  temperature: 0.2,
};

const DEFAULT_VALIDATION_LIBRARY = [
  "transfer-check",
  "case-application",
  "reflection-check",
  "mini-quiz",
];
const USER_PROGRESS_STAGE_ID = "zasterix-teacher";

const extractCompletedStepIds = (value: string) =>
  Array.from(value.matchAll(/UPDATE_STEP_(\d+)_COMPLETED/g), (match) =>
    Number.parseInt(match[1], 10),
  ).filter((id) => Number.isFinite(id));

const inferCompletedStepIdsFromUserMessage = (
  userMessage: string,
  roadmap: CourseStep[],
) => {
  const completionIntentRegex =
    /(beherrsch|verstanden|abgeschlossen|fertig|done|completed|mastered|geschafft)/i;
  if (!completionIntentRegex.test(userMessage)) {
    return [] as number[];
  }

  const directIds = Array.from(
    userMessage.matchAll(/(?:modul|module|schritt|step)\s*(\d+)/gi),
    (match) => Number.parseInt(match[1], 10),
  ).filter((id) => Number.isFinite(id));

  if (directIds.length > 0) {
    return directIds;
  }

  const lowercase = userMessage.toLowerCase();
  const fallbackMap: Record<string, number> = {
    erstes: 1,
    erste: 1,
    zweites: 2,
    zweite: 2,
    drittes: 3,
    dritte: 3,
    viertes: 4,
    vierte: 4,
    fuenftes: 5,
    fuenfte: 5,
    fünftes: 5,
    fünfte: 5,
  };

  const inferred = Object.entries(fallbackMap)
    .filter(([token]) => lowercase.includes(token))
    .map(([, id]) => id);

  if (inferred.length === 0) {
    return [];
  }

  const knownIds = roadmap
    .map((step) =>
      typeof step.id === "number" ? step.id : Number.parseInt(step.id, 10),
    )
    .filter((id) => Number.isFinite(id));

  return inferred.filter((id) => (knownIds.length ? knownIds.includes(id) : true));
};

const applyCompletedStepIdsToRoadmap = (
  roadmap: CourseStep[],
  completedStepIds: number[],
) => {
  if (completedStepIds.length === 0) {
    return roadmap;
  }

  return roadmap.map((step) => {
    const stepId = typeof step.id === "number" ? step.id : Number.parseInt(step.id, 10);
    if (Number.isFinite(stepId) && completedStepIds.includes(stepId)) {
      return { ...step, status: "completed" as const };
    }
    return step;
  });
};

const toCourseRoadmap = (value: unknown): CourseStep[] | null => {
  if (!Array.isArray(value)) return null;

  const parsed = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const id = record.id;
      const title = record.title;
      const status = record.status;
      const stepType = record.type;
      const content = record.content;

      if (
        (typeof id !== "number" && typeof id !== "string") ||
        typeof title !== "string" ||
        typeof status !== "string"
      ) {
        return null;
      }

      const nextStep: CourseStep = {
        id,
        title,
        status,
        content: typeof content === "string" ? content : null,
      };
      if (typeof stepType === "string" && stepType.trim().length > 0) {
        nextStep.type = stepType;
      }
      return nextStep;
    })
    .filter((step): step is CourseStep => Boolean(step));

  return parsed.length > 0 ? parsed : null;
};

const normalizeStepIdKey = (value: number | string) => String(value).trim();

const isSameStepId = (left: number | string, right: number | string) =>
  normalizeStepIdKey(left) === normalizeStepIdKey(right);

const hasStepContent = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0;

const toAutoFillStep = (value: unknown): AutoFillStep | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record.id;
  const title = record.title;
  const stepType = record.type;
  const discipline = record.discipline;
  if ((typeof id !== "number" && typeof id !== "string") || typeof title !== "string") {
    return null;
  }

  return {
    id,
    title,
    type: typeof stepType === "string" && stepType.trim().length > 0 ? stepType : undefined,
    discipline:
      typeof discipline === "string" && discipline.trim().length > 0
        ? discipline
        : undefined,
  };
};

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const toAiModelConfig = (value: unknown): AiModelConfig | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const provider = typeof record.provider === "string" ? record.provider.trim() : "";
  const model = typeof record.model === "string" ? record.model.trim() : "";
  if (!provider || !model) {
    return null;
  }

  const temperature = toFiniteNumber(record.temperature);
  const maxTokens =
    toFiniteNumber(record.maxTokens) ?? toFiniteNumber(record.max_tokens);
  const topP = toFiniteNumber(record.topP) ?? toFiniteNumber(record.top_p);

  return {
    provider,
    model,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    ...(topP !== undefined ? { topP } : {}),
  };
};

const toValidationLibrary = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
        .filter((entry) => entry.length > 0),
    ),
  );
};

const normalizeStepIdValue = (value: number | string) => String(value).trim();

const findFirstPendingStep = (roadmap: CourseStep[] | null) =>
  roadmap?.find((step) => step.status !== "completed") ?? null;

const buildProgressModuleId = ({
  agentId,
  stepId,
}: {
  agentId: string;
  stepId: number | string;
}) => `${agentId}-module-${normalizeStepIdValue(stepId)}`;

const validationPendingTokenPrefix = ({
  agentId,
  stepId,
}: {
  agentId: string;
  stepId: number | string;
}) => `validation_pending:${agentId}:${normalizeStepIdValue(stepId)}:`;

const validationPassedTokenPrefix = ({
  agentId,
  stepId,
}: {
  agentId: string;
  stepId: number | string;
}) => `validation_passed:${agentId}:${normalizeStepIdValue(stepId)}:`;

const extractValidationSelectionMap = (value: string) => {
  const selections = new Map<string, string>();
  const regex = /VALIDATION_TYPE_([A-Za-z0-9-]+)_([A-Za-z0-9_-]+)/g;
  for (const match of value.matchAll(regex)) {
    const stepId = match[1];
    const validationType = match[2]?.toLowerCase();
    if (stepId && validationType) {
      selections.set(stepId, validationType);
    }
  }
  return selections;
};

const extractValidationPassedStepIds = (value: string) =>
  Array.from(
    new Set(
      Array.from(
        value.matchAll(/VALIDATION_RESULT_([A-Za-z0-9-]+)_PASSED/g),
        (match) => match[1],
      ).filter((stepId) => stepId.length > 0),
    ),
  );

const sanitizeValidationMarkers = (value: string) =>
  value
    .replace(/VALIDATION_TYPE_[A-Za-z0-9-]+_[A-Za-z0-9_-]+/g, "")
    .replace(/VALIDATION_RESULT_[A-Za-z0-9-]+_(?:PASSED|FAILED)/g, "");

const buildValidationLibraryInstruction = (library: string[]) =>
  [
    "VALIDATION_LIBRARY:",
    ...library.map((entry) => `- ${entry}`),
    "",
    "Modulwechsel-Regel:",
    "- Bei Modulwechsel waehle autonom genau eine Validierungsart aus der Bibliothek.",
    "- Gib Marker aus: VALIDATION_TYPE_[NEXT_MODULE_ID]_[TYPE].",
    "- Wenn Validierung aktiv ist, pausiere den Fachdialog bis bestanden.",
    "- Bei bestanden: VALIDATION_RESULT_[MODULE_ID]_PASSED.",
    "- Bei nicht bestanden: VALIDATION_RESULT_[MODULE_ID]_FAILED.",
  ].join("\n");

const loadAgentModelConfig = async (agentId: string): Promise<AiModelConfig | null> => {
  if (!supabaseAdmin) {
    return null;
  }

  const { data: agentData, error: agentError } = await supabaseAdmin
    .from("agent_templates")
    .select("ai_model_config, parent_template_id")
    .eq("id", agentId)
    .maybeSingle();

  if (agentError || !agentData) {
    if (agentError) {
      console.error("Agent model config load error:", agentError);
    }
    return null;
  }

  if (typeof agentData.parent_template_id === "string") {
    const { data: blueprintData, error: blueprintError } = await supabaseAdmin
      .from("agent_blueprints")
      .select("ai_model_config")
      .eq("id", agentData.parent_template_id)
      .maybeSingle();

    if (blueprintError) {
      console.error("Blueprint model config load error:", blueprintError);
    } else {
      const blueprintConfig = toAiModelConfig(blueprintData?.ai_model_config);
      if (blueprintConfig) {
        return blueprintConfig;
      }
    }
  }

  return toAiModelConfig(agentData.ai_model_config);
};

const loadAgentValidationLibrary = async (agentId: string): Promise<string[]> => {
  if (!supabaseAdmin) {
    return [];
  }

  const { data: agentData, error: agentError } = await supabaseAdmin
    .from("agent_templates")
    .select("parent_template_id")
    .eq("id", agentId)
    .maybeSingle();

  if (agentError || !agentData) {
    if (agentError) {
      console.error("Validation library load error:", agentError);
    }
    return [];
  }

  if (typeof agentData.parent_template_id === "string") {
    const { data: blueprintData, error: blueprintError } = await supabaseAdmin
      .from("agent_blueprints")
      .select("validation_library")
      .eq("id", agentData.parent_template_id)
      .maybeSingle();

    if (blueprintError) {
      console.error("Blueprint validation library load error:", blueprintError);
    } else {
      const blueprintLibrary = toValidationLibrary(blueprintData?.validation_library);
      if (blueprintLibrary.length > 0) {
        return blueprintLibrary;
      }
    }
  }

  return [];
};

const resolveModelFactory = (provider: string) => {
  const normalizedProvider = provider.trim().toLowerCase();
  if (normalizedProvider === "groq") {
    if (!groqFactory) {
      throw new Error("GROQ_API_KEY fehlt.");
    }
    return groqFactory;
  }

  if (normalizedProvider === "openai") {
    if (!openaiFactory) {
      throw new Error("OPENAI_API_KEY fehlt.");
    }
    return openaiFactory;
  }

  throw new Error(`Provider nicht unterstuetzt: ${provider}`);
};

type ValidationGateState = {
  type: string;
  pending: boolean;
  passed: boolean;
};

const readValidationGateState = ({
  completedTasks,
  agentId,
  stepId,
}: {
  completedTasks: string[];
  agentId: string;
  stepId: number | string;
}): ValidationGateState | null => {
  const pendingPrefix = validationPendingTokenPrefix({ agentId, stepId });
  const passedPrefix = validationPassedTokenPrefix({ agentId, stepId });
  const pendingToken = completedTasks.find((task) => task.startsWith(pendingPrefix));
  const passedToken = completedTasks.find((task) => task.startsWith(passedPrefix));

  const typeFromPending = pendingToken ? pendingToken.slice(pendingPrefix.length) : null;
  const typeFromPassed = passedToken ? passedToken.slice(passedPrefix.length) : null;
  const resolvedType = typeFromPending || typeFromPassed;
  if (!resolvedType) {
    return null;
  }

  return {
    type: resolvedType,
    pending: Boolean(pendingToken),
    passed: Boolean(passedToken),
  };
};

const loadProgressRow = async ({
  userId,
  agentId,
  stepId,
}: {
  userId: string;
  agentId: string;
  stepId: number | string;
}) => {
  if (!supabaseAdmin) {
    return { completedTasks: [] as string[] };
  }

  const moduleId = buildProgressModuleId({ agentId, stepId });
  const { data, error } = await supabaseAdmin
    .from("user_progress")
    .select("completed_tasks")
    .eq("user_id", userId)
    .eq("stage_id", USER_PROGRESS_STAGE_ID)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (error) {
    console.error("user_progress read error:", error);
  }

  return {
    completedTasks: Array.isArray(data?.completed_tasks)
      ? data.completed_tasks.filter((entry) => typeof entry === "string")
      : [],
  };
};

const upsertProgressValidationState = async ({
  userId,
  organizationId,
  agentId,
  stepId,
  completedTasks,
  isCompleted,
}: {
  userId: string;
  organizationId: string | null;
  agentId: string;
  stepId: number | string;
  completedTasks: string[];
  isCompleted: boolean;
}) => {
  if (!supabaseAdmin) {
    return;
  }

  const moduleId = buildProgressModuleId({ agentId, stepId });
  const { error } = await supabaseAdmin.from("user_progress").upsert(
    {
      user_id: userId,
      organization_id: organizationId,
      stage_id: USER_PROGRESS_STAGE_ID,
      module_id: moduleId,
      completed_tasks: completedTasks,
      is_completed: isCompleted,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,stage_id,module_id" },
  );

  if (error) {
    console.error("user_progress validation upsert error:", error);
  }
};

const loadAgentRoadmap = async (agentId: string): Promise<CourseStep[] | null> => {
  if (!supabaseAdmin) {
    return null;
  }

  const { data: agentData, error: agentLoadError } = await supabaseAdmin
    .from("agent_templates")
    .select("course_roadmap")
    .eq("id", agentId)
    .maybeSingle();

  if (agentLoadError) {
    console.error("Roadmap load error:", agentLoadError);
    return null;
  }

  return toCourseRoadmap(agentData?.course_roadmap);
};

const withUpdatedStepContent = (
  roadmap: CourseStep[],
  stepId: number | string,
  content: string,
) => {
  let changed = false;
  const updated = roadmap.map((step) => {
    if (!isSameStepId(step.id, stepId)) {
      return step;
    }
    changed = true;
    return { ...step, content };
  });
  return changed ? updated : null;
};

const persistRoadmap = async (agentId: string, roadmap: CourseStep[]) => {
  if (!supabaseAdmin) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY missing. Roadmap persistence skipped.",
    );
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("agent_templates")
    .update({ course_roadmap: roadmap })
    .eq("id", agentId);

  if (updateError) {
    console.error("Roadmap persistence error:", updateError);
  }
};

const buildAutoFillInstruction = (
  step: Pick<CourseStep, "title" | "type">,
  discipline: string,
) =>
  `Generiere basierend auf deiner discipline und dem step.title einen ausfuehrlichen Lerninhalt (mind. 300 Woerter) fuer den Typ ${
    step.type || "lesson"
  }. discipline=${discipline}; step.title=${step.title}. Gib ausschliesslich den Lerninhalt ohne Rueckfrage aus.`;

const toSharedLogicInstruction = (
  logicKey: string,
  logicPayload: Record<string, unknown> | null,
) => {
  const standards = Array.isArray(logicPayload?.standards)
    ? logicPayload.standards
        .map((entry) => (typeof entry === "string" ? entry : ""))
        .filter((entry) => entry.length > 0)
    : [];
  const standardsText = standards.length
    ? standards.map((entry) => `- ${entry}`).join("\n")
    : "- Halte Antworten minimalistisch, data-driven und standardkonform.";
  return `SHARED_LOGIC (${logicKey})\n${standardsText}`;
};

const loadAgentSharedLogicInstruction = async (agentId: string) => {
  if (!supabaseAdmin) {
    return null;
  }

  const { data: agentRow, error: agentError } = await supabaseAdmin
    .from("agent_templates")
    .select("shared_logic_id")
    .eq("id", agentId)
    .maybeSingle();

  if (agentError || !agentRow?.shared_logic_id) {
    if (agentError) {
      console.warn("Shared logic lookup skipped:", agentError.message);
    }
    return null;
  }

  const { data: logicRow, error: logicError } = await supabaseAdmin
    .from("shared_logic")
    .select("logic_key, logic_payload, is_active")
    .eq("id", agentRow.shared_logic_id)
    .eq("is_active", true)
    .maybeSingle();

  if (logicError || !logicRow) {
    if (logicError) {
      console.warn("Shared logic load skipped:", logicError.message);
    }
    return null;
  }

  const logicPayload =
    logicRow.logic_payload &&
    typeof logicRow.logic_payload === "object" &&
    !Array.isArray(logicRow.logic_payload)
      ? (logicRow.logic_payload as Record<string, unknown>)
      : null;

  return toSharedLogicInstruction(logicRow.logic_key, logicPayload);
};

const applyGeneratedStepContent = async ({
  generatedText,
  agentId,
  targetStep,
  roadmapCandidate,
}: {
  generatedText: string;
  agentId?: string;
  targetStep: CourseStep | null;
  roadmapCandidate: CourseStep[] | null;
}) => {
  if (!targetStep || !hasStepContent(generatedText)) {
    return roadmapCandidate;
  }

  let roadmapBase = roadmapCandidate;
  if ((!roadmapBase || roadmapBase.length === 0) && agentId) {
    roadmapBase = await loadAgentRoadmap(agentId);
  }
  if (!roadmapBase || roadmapBase.length === 0) {
    return roadmapCandidate;
  }

  const updatedRoadmap = withUpdatedStepContent(
    roadmapBase,
    targetStep.id,
    generatedText.trim(),
  );
  if (!updatedRoadmap) {
    return roadmapBase;
  }

  if (agentId) {
    await persistRoadmap(agentId, updatedRoadmap);
  }

  return updatedRoadmap;
};

const sanitizeAssistantContent = (value: string) =>
  sanitizeValidationMarkers(
    value
      .replace(/COURSE_JSON_START[\s\S]*?COURSE_JSON_END/g, "")
      .replace(/UPDATE_STEP_\d+_COMPLETED/g, ""),
  );

const sanitizeAssistantContentPartial = (value: string) => {
  let cleaned = sanitizeAssistantContent(value);
  const openCourseBlockIndex = cleaned.lastIndexOf("COURSE_JSON_START");
  if (openCourseBlockIndex !== -1) {
    cleaned = cleaned.slice(0, openCourseBlockIndex);
  }
  return sanitizeValidationMarkers(cleaned.replace(/UPDATE_STEP_[\d_]*$/g, ""));
};

const STREAM_CHUNK_SIZE = 28;

const emitChunkedText = ({
  text,
  sendEvent,
}: {
  text: string;
  sendEvent: (event: Record<string, unknown>) => void;
}) => {
  if (!text) {
    return;
  }

  for (let index = 0; index < text.length; index += STREAM_CHUNK_SIZE) {
    sendEvent({
      type: "chunk",
      text: text.slice(index, index + STREAM_CHUNK_SIZE),
    });
  }
};

const finalizeAiPayload = async ({
  aiContent,
  userMessage,
  agentId,
  fallbackRoadmap,
}: {
  aiContent: string;
  userMessage: string;
  agentId?: string;
  fallbackRoadmap?: CourseStep[] | null;
}) => {
  const courseJsonMatch = aiContent.match(
    /COURSE_JSON_START([\s\S]*?)COURSE_JSON_END/,
  );
  let roadmapPayload: CourseStep[] | null = null;

  if (courseJsonMatch) {
    try {
      const parsedJson = JSON.parse(courseJsonMatch[1].trim()) as unknown;
      const roadmapData = toCourseRoadmap(parsedJson);
      roadmapPayload = roadmapData;

      if (roadmapData && agentId) {
        if (supabaseAdmin) {
          const { error: updateError } = await supabaseAdmin
            .from("agent_templates")
            .update({ course_roadmap: roadmapData })
            .eq("id", agentId);

          if (updateError) {
            console.error("Roadmap update error:", updateError);
          }
        } else {
          console.warn(
            "SUPABASE_SERVICE_ROLE_KEY missing. Roadmap update skipped.",
          );
        }
      }
    } catch (parseError: unknown) {
      console.error("Parsing Error", parseError);
    }
  }

  const completionMarkersFromAi = extractCompletedStepIds(aiContent);
  const completionMarkersFromUser = inferCompletedStepIdsFromUserMessage(
    userMessage,
    roadmapPayload ?? [],
  );
  const completedStepIds = Array.from(
    new Set([...completionMarkersFromAi, ...completionMarkersFromUser]),
  );

  if (agentId && completedStepIds.length > 0) {
    let baseRoadmap = roadmapPayload ?? fallbackRoadmap ?? null;

    if (!baseRoadmap && supabaseAdmin) {
      baseRoadmap = await loadAgentRoadmap(agentId);
    }

    if (baseRoadmap && baseRoadmap.length > 0) {
      const agent = { course_roadmap: baseRoadmap };
      const updatedRoadmap = applyCompletedStepIdsToRoadmap(
        agent.course_roadmap,
        completedStepIds,
      );
      roadmapPayload = updatedRoadmap;

      if (supabaseAdmin) {
        const { error: updateStepError } = await supabaseAdmin
          .from("agent_templates")
          .update({ course_roadmap: updatedRoadmap })
          .eq("id", agentId);

        if (updateStepError) {
          console.error("Roadmap completion update error:", updateStepError);
        }
      } else {
        console.warn(
          "SUPABASE_SERVICE_ROLE_KEY missing. Completion marker persisted only in response payload.",
        );
      }
    }
  }

  const cleanText = sanitizeAssistantContent(aiContent).trim();
  return {
    cleanText,
    roadmapPayload,
    completedStepIds,
  };
};

export async function POST(req: Request) {
  try {
    const {
      message,
      agentId,
      systemPrompt,
      agentName,
      history,
      hiddenInstruction,
      stream,
      autoFillStep,
      roadmapSnapshot,
      aiModelConfig,
      validationLibrary,
      userId,
      organizationId,
    } =
      (await req.json()) as {
      message?: string;
      agentId?: string;
      systemPrompt?: string;
      agentName?: string;
      history?: ChatHistoryEntry[];
      hiddenInstruction?: string;
      stream?: boolean;
      autoFillStep?: unknown;
      roadmapSnapshot?: unknown;
      aiModelConfig?: unknown;
      validationLibrary?: unknown;
      userId?: string;
      organizationId?: string | null;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Nachricht fehlt." }, { status: 400 });
    }

    const requestedModelConfig = toAiModelConfig(aiModelConfig);
    const dbModelConfig = agentId ? await loadAgentModelConfig(agentId) : null;
    const resolvedModelConfig =
      dbModelConfig ?? requestedModelConfig ?? GROQ_FALLBACK_MODEL_CONFIG;
    const aiFactory = resolveModelFactory(resolvedModelConfig.provider);
    const aiModel = aiFactory(resolvedModelConfig.model);
    const generationTemperature = resolvedModelConfig.temperature ?? 0.2;
    const generationMaxTokens = resolvedModelConfig.maxTokens;
    const generationTopP = resolvedModelConfig.topP;

    const globalInstruction = `
      ZUSATZ-ANWEISUNG: Wenn der Nutzer nach einem Kurs, Lernplan oder Schritten fragt, erstelle einen Plan mit 5 Modulen.
      Antworte erst normal und fuege am Ende EXAKT diesen Block an:
      COURSE_JSON_START
      [
        {"id": 1, "title": "Einfuehrung", "status": "pending"},
        {"id": 2, "title": "Grundlagen", "status": "pending"},
        {"id": 3, "title": "Anwendung", "status": "pending"},
        {"id": 4, "title": "Vertiefung", "status": "pending"},
        {"id": 5, "title": "Abschluss", "status": "pending"}
      ]
      COURSE_JSON_END

      WICHTIG: Wenn der Nutzer zeigt, dass er ein bestimmtes Modul beherrscht oder abgeschlossen hat,
      markiere dieses Modul als erledigt und fuege in einer EIGENEN ZEILE am ENDE der Antwort EXAKT den Marker hinzu:
      UPDATE_STEP_[ID]_COMPLETED
      (Beispiel: UPDATE_STEP_2_COMPLETED)

      Wenn ein VERSTECKTER UNTERRICHTSBEFEHL gesetzt ist, fuehre ihn strikt aus und priorisiere diese Anweisung.
      Erzeuge in diesem Fall keinen COURSE_JSON-Block, ausser die versteckte Anweisung verlangt ihn explizit.
    `;

    const resolvedSystemPrompt =
      systemPrompt ||
      `Du bist ein professioneller Agent der Zasterix-Organisation.${
        agentName ? ` Name: ${agentName}.` : ""
      }`;
    const sharedLogicInstruction = agentId
      ? await loadAgentSharedLogicInstruction(agentId)
      : null;
    const hiddenSystemInstruction =
      typeof hiddenInstruction === "string" && hiddenInstruction.trim().length > 0
        ? hiddenInstruction.trim()
        : null;

    const normalizedMessage = message.trim();
    const shouldStream = Boolean(stream);
    const normalizedUserId =
      typeof userId === "string" && userId.trim().length > 0 ? userId.trim() : null;
    const normalizedOrganizationId =
      typeof organizationId === "string" && organizationId.trim().length > 0
        ? organizationId.trim()
        : null;
    const requestValidationLibrary = toValidationLibrary(validationLibrary);
    const dbValidationLibrary = agentId ? await loadAgentValidationLibrary(agentId) : [];
    const resolvedValidationLibrary =
      dbValidationLibrary.length > 0
        ? dbValidationLibrary
        : requestValidationLibrary.length > 0
          ? requestValidationLibrary
          : DEFAULT_VALIDATION_LIBRARY;
    const validationLibraryInstruction = buildValidationLibraryInstruction(
      resolvedValidationLibrary,
    );
    const requestedAutoFillStep = toAutoFillStep(autoFillStep);
    const snapshotRoadmap = toCourseRoadmap(roadmapSnapshot);
    let roadmapForAutoFill = snapshotRoadmap;
    if (agentId && (!roadmapForAutoFill || roadmapForAutoFill.length === 0)) {
      const dbRoadmap = await loadAgentRoadmap(agentId);
      if (dbRoadmap && dbRoadmap.length > 0) {
        roadmapForAutoFill = dbRoadmap;
      }
    }
    if (requestedAutoFillStep && agentId) {
      const dbRoadmap = await loadAgentRoadmap(agentId);
      if (dbRoadmap && dbRoadmap.length > 0) {
        roadmapForAutoFill = dbRoadmap;
      }
    }

    const activeValidationStep = findFirstPendingStep(roadmapForAutoFill);
    let pendingValidationGate:
      | { stepId: string; type: string }
      | null = null;
    if (normalizedUserId && agentId && activeValidationStep) {
      const progressRow = await loadProgressRow({
        userId: normalizedUserId,
        agentId,
        stepId: activeValidationStep.id,
      });
      const gateState = readValidationGateState({
        completedTasks: progressRow.completedTasks,
        agentId,
        stepId: activeValidationStep.id,
      });
      if (gateState?.pending && !gateState.passed) {
        pendingValidationGate = {
          stepId: normalizeStepIdValue(activeValidationStep.id),
          type: gateState.type,
        };
      }
    }

    const currentAutoFillStep = requestedAutoFillStep
      ? roadmapForAutoFill?.find((step) => isSameStepId(step.id, requestedAutoFillStep.id))
      : null;
    const effectiveAutoFillStep =
      currentAutoFillStep ??
      (requestedAutoFillStep
        ? {
            id: requestedAutoFillStep.id,
            title: requestedAutoFillStep.title,
            status: "pending",
            type: requestedAutoFillStep.type,
            content: null,
          }
        : null);
    const shouldGenerateAutoFillContent =
      Boolean(effectiveAutoFillStep) && !hasStepContent(currentAutoFillStep?.content);
    const autoFillInstruction =
      shouldGenerateAutoFillContent && effectiveAutoFillStep
        ? buildAutoFillInstruction(
            {
              title: effectiveAutoFillStep.title,
              type: effectiveAutoFillStep.type,
            },
            requestedAutoFillStep?.discipline || "General",
          )
        : null;
    const validationPauseInstruction = pendingValidationGate
      ? `DIALOG-PAUSE AKTIV: Modul ${pendingValidationGate.stepId} ist gesperrt. Fuehre ausschliesslich die Validierung "${pendingValidationGate.type}" durch. Erlaube KEINEN Modulfortschritt, bis du VALIDATION_RESULT_${pendingValidationGate.stepId}_PASSED ausgibst.`
      : null;
    const effectiveHiddenSystemInstruction = [
      hiddenSystemInstruction,
      autoFillInstruction,
      validationLibraryInstruction,
      validationPauseInstruction,
    ]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .join("\n\n");

    const normalizedHistory = Array.isArray(history)
      ? history
          .filter(
            (entry) =>
              entry &&
              (entry.role === "assistant" ||
                entry.role === "user" ||
                entry.role === "system") &&
              typeof entry.content === "string" &&
              entry.content.trim().length > 0,
          )
          .map((entry) => ({
            role: entry.role,
            content: entry.content.trim(),
          }))
          .slice(-12)
      : [];

    const historyWithCurrentMessage = (() => {
      if (normalizedHistory.length === 0) {
        return [{ role: "user" as const, content: normalizedMessage }];
      }

      const lastEntry = normalizedHistory[normalizedHistory.length - 1];
      if (
        lastEntry.role === "user" &&
        lastEntry.content.toLowerCase() === normalizedMessage.toLowerCase()
      ) {
        return normalizedHistory;
      }

      return [
        ...normalizedHistory,
        { role: "user" as const, content: normalizedMessage },
      ];
    })();

    const requestMessages = [
      {
        role: "system" as const,
        content: [
          resolvedSystemPrompt,
          sharedLogicInstruction,
          globalInstruction,
          effectiveHiddenSystemInstruction
            ? `VERSTECKTER UNTERRICHTSBEFEHL:\n${effectiveHiddenSystemInstruction}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      ...historyWithCurrentMessage,
    ];

    const handleValidationProgressUpdate = async ({
      aiContent,
      roadmapCandidate,
      completedStepIds,
    }: {
      aiContent: string;
      roadmapCandidate: CourseStep[] | null;
      completedStepIds: number[];
    }) => {
      let validationMeta: {
        paused: boolean;
        stepId: string | null;
        type: string | null;
      } = pendingValidationGate
        ? {
            paused: true,
            stepId: pendingValidationGate.stepId,
            type: pendingValidationGate.type,
          }
        : { paused: false, stepId: null, type: null };

      if (!normalizedUserId || !agentId) {
        return validationMeta;
      }

      const passedStepIds = extractValidationPassedStepIds(aiContent);
      for (const stepId of passedStepIds) {
        const progressRow = await loadProgressRow({
          userId: normalizedUserId,
          agentId,
          stepId,
        });
        const gateState = readValidationGateState({
          completedTasks: progressRow.completedTasks,
          agentId,
          stepId,
        });
        if (!gateState) {
          continue;
        }

        const pendingPrefix = validationPendingTokenPrefix({ agentId, stepId });
        const passedPrefix = validationPassedTokenPrefix({ agentId, stepId });
        const nextTasks = progressRow.completedTasks.filter(
          (task) => !task.startsWith(pendingPrefix),
        );
        const passedToken = `${passedPrefix}${gateState.type}`;
        if (!nextTasks.includes(passedToken)) {
          nextTasks.push(passedToken);
        }
        const unlockToken = `validation_unlocked:${agentId}:${stepId}`;
        if (!nextTasks.includes(unlockToken)) {
          nextTasks.push(unlockToken);
        }

        await upsertProgressValidationState({
          userId: normalizedUserId,
          organizationId: normalizedOrganizationId,
          agentId,
          stepId,
          completedTasks: nextTasks,
          isCompleted: true,
        });

        if (validationMeta.stepId === stepId) {
          validationMeta = { paused: false, stepId: null, type: null };
        }
      }

      const nextStep = findFirstPendingStep(roadmapCandidate ?? roadmapForAutoFill);
      if (nextStep && completedStepIds.length > 0) {
        const nextStepId = normalizeStepIdValue(nextStep.id);
        const progressRow = await loadProgressRow({
          userId: normalizedUserId,
          agentId,
          stepId: nextStep.id,
        });
        const gateState = readValidationGateState({
          completedTasks: progressRow.completedTasks,
          agentId,
          stepId: nextStep.id,
        });

        if (!gateState || (!gateState.pending && !gateState.passed)) {
          const selectedType =
            extractValidationSelectionMap(aiContent).get(nextStepId) ??
            resolvedValidationLibrary[0] ??
            "transfer-check";
          const pendingPrefix = validationPendingTokenPrefix({
            agentId,
            stepId: nextStep.id,
          });
          const passedPrefix = validationPassedTokenPrefix({
            agentId,
            stepId: nextStep.id,
          });
          const nextTasks = Array.from(
            new Set([
              ...progressRow.completedTasks.filter(
                (task) =>
                  !task.startsWith(pendingPrefix) && !task.startsWith(passedPrefix),
              ),
              `${pendingPrefix}${selectedType}`,
            ]),
          );

          await upsertProgressValidationState({
            userId: normalizedUserId,
            organizationId: normalizedOrganizationId,
            agentId,
            stepId: nextStep.id,
            completedTasks: nextTasks,
            isCompleted: false,
          });

          validationMeta = {
            paused: true,
            stepId: nextStepId,
            type: selectedType,
          };
        } else if (gateState.pending && !gateState.passed) {
          validationMeta = {
            paused: true,
            stepId: nextStepId,
            type: gateState.type,
          };
        }
      }

      return validationMeta;
    };

    if (shouldStream) {
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        start(controller) {
          const sendEvent = (event: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          };

          const run = async () => {
            try {
              const completionStream = streamText({
                model: aiModel,
                messages: requestMessages,
                temperature: generationTemperature,
                ...(generationMaxTokens !== undefined
                  ? { maxTokens: generationMaxTokens }
                  : {}),
                ...(generationTopP !== undefined ? { topP: generationTopP } : {}),
              });

              let aiContent = "";
              let visibleLength = 0;

              for await (const deltaText of completionStream.textStream) {
                if (typeof deltaText !== "string" || deltaText.length === 0) {
                  continue;
                }

                aiContent += deltaText;
                const visibleText = sanitizeAssistantContentPartial(aiContent);
                const nextChunk = visibleText.slice(visibleLength);
                if (nextChunk.length > 0) {
                  visibleLength = visibleText.length;
                  emitChunkedText({ text: nextChunk, sendEvent });
                }
              }

              const finalized = await finalizeAiPayload({
                aiContent,
                userMessage: normalizedMessage,
                agentId,
                fallbackRoadmap: roadmapForAutoFill,
              });
              const roadmapWithGeneratedContent =
                shouldGenerateAutoFillContent && effectiveAutoFillStep
                  ? await applyGeneratedStepContent({
                      generatedText: finalized.cleanText,
                      agentId,
                      targetStep: effectiveAutoFillStep,
                      roadmapCandidate: finalized.roadmapPayload ?? roadmapForAutoFill,
                    })
                  : finalized.roadmapPayload;
              const validationMeta = await handleValidationProgressUpdate({
                aiContent,
                roadmapCandidate: roadmapWithGeneratedContent ?? roadmapForAutoFill,
                completedStepIds: finalized.completedStepIds,
              });
              sendEvent({ type: "final_text", text: finalized.cleanText });
              sendEvent({
                type: "meta",
                roadmap: roadmapWithGeneratedContent,
                completedStepIds: finalized.completedStepIds,
                validation: validationMeta,
              });
              sendEvent({ type: "done" });
            } catch (streamError: unknown) {
              console.error("Chat stream error:", streamError);
              sendEvent({
                type: "error",
                message:
                  streamError instanceof Error
                    ? streamError.message
                    : "Fehler bei der Kommunikation mit dem Agenten.",
              });
            } finally {
              controller.close();
            }
          };

          void run();
        },
      });

      return new Response(streamResponse, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const response = await generateText({
      model: aiModel,
      messages: requestMessages,
      temperature: generationTemperature,
      ...(generationMaxTokens !== undefined
        ? { maxTokens: generationMaxTokens }
        : {}),
      ...(generationTopP !== undefined ? { topP: generationTopP } : {}),
    });

    const aiContent = response.text ?? "";
    const finalized = await finalizeAiPayload({
      aiContent,
      userMessage: normalizedMessage,
      agentId,
      fallbackRoadmap: roadmapForAutoFill,
    });
    const roadmapWithGeneratedContent =
      shouldGenerateAutoFillContent && effectiveAutoFillStep
        ? await applyGeneratedStepContent({
            generatedText: finalized.cleanText,
            agentId,
            targetStep: effectiveAutoFillStep,
            roadmapCandidate: finalized.roadmapPayload ?? roadmapForAutoFill,
          })
        : finalized.roadmapPayload;
    const validationMeta = await handleValidationProgressUpdate({
      aiContent,
      roadmapCandidate: roadmapWithGeneratedContent ?? roadmapForAutoFill,
      completedStepIds: finalized.completedStepIds,
    });
    return NextResponse.json({
      text: finalized.cleanText,
      roadmap: roadmapWithGeneratedContent,
      completedStepIds: finalized.completedStepIds,
      validation: validationMeta,
    });
  } catch (error: unknown) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

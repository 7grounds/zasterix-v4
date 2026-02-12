/**
 * @MODULE_ID app.chat.agent
 * @STAGE admin
 * @DATA_INPUTS ["agent_templates", "agent_blueprints", "chat_messages"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import { createClient } from "@supabase/supabase-js";
import ChatWindow from "./ChatWindow";

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
  category: string;
  parentTemplateId: string | null;
  parent_template_id: string | null;
  systemPrompt: string;
  system_prompt: string;
  logicTemplate: string;
  logic_template: string;
  finalSystemPrompt: string;
  final_system_prompt: string;
  aiModelConfig: AiModelConfig | null;
  ai_model_config: AiModelConfig | null;
  courseRoadmap: CourseStep[];
  course_roadmap: CourseStep[];
};

type AiModelConfig = {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
};

type CourseStep = {
  id: number | string;
  title: string;
  status: string;
  type?: string;
  content?: string | null;
};

type BlueprintRecord = {
  id: string;
  logic_template: string | null;
  ai_model_config: AiModelConfig | null;
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

const toCourseRoadmap = (value: unknown): CourseStep[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
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
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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
  const record = asObject(value);
  if (!record) {
    return null;
  }
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

const composeSystemPrompt = (logicTemplate: string, expertisePrompt: string) => {
  const base = logicTemplate.trim();
  const expertise = expertisePrompt.trim();
  return [base, expertise].filter((entry) => entry.length > 0).join("\n\n");
};

const buildFallbackAgent = (id: string): AgentRecord => {
    const fallbackPrompt =
      "Du bist ein professioneller Agent der Zasterix-Organisation.";
    return {
      id,
      name: "Unbekannter Agent",
      level: 0,
      category: "System",
      parentTemplateId: null,
      parent_template_id: null,
      systemPrompt: fallbackPrompt,
      system_prompt: fallbackPrompt,
      logicTemplate: "",
      logic_template: "",
      finalSystemPrompt: fallbackPrompt,
      final_system_prompt: fallbackPrompt,
      aiModelConfig: null,
      ai_model_config: null,
      courseRoadmap: [],
      course_roadmap: [],
    };
};

const toAgentRecord = ({
  value,
  blueprint,
  id,
}: {
  value: unknown;
  blueprint: BlueprintRecord | null;
  id: string;
}): AgentRecord => {
  const record = asObject(value);
  if (!record) {
    return buildFallbackAgent(id);
  }
  const systemPrompt =
    typeof record.system_prompt === "string"
      ? record.system_prompt
      : "Du bist ein professioneller Agent der Zasterix-Organisation.";
  const logicTemplate =
    blueprint?.logic_template && blueprint.logic_template.trim().length > 0
      ? blueprint.logic_template
      : "";
  const finalSystemPrompt = composeSystemPrompt(logicTemplate, systemPrompt) || systemPrompt;
  const parentTemplateId =
    typeof record.parent_template_id === "string"
      ? record.parent_template_id
      : null;
  const aiModelConfig = toAiModelConfig(
    blueprint?.ai_model_config ?? record.ai_model_config,
  );
  const courseRoadmap = toCourseRoadmap(record.course_roadmap);

  return {
    id: typeof record.id === "string" ? record.id : id,
    name: typeof record.name === "string" ? record.name : "Unbekannter Agent",
    level: normalizeLevel(record.level),
    category: typeof record.category === "string" ? record.category : "System",
    parentTemplateId,
    parent_template_id: parentTemplateId,
    systemPrompt,
    system_prompt: systemPrompt,
    logicTemplate,
    logic_template: logicTemplate,
    finalSystemPrompt,
    final_system_prompt: finalSystemPrompt,
    aiModelConfig,
    ai_model_config: aiModelConfig,
    courseRoadmap,
    course_roadmap: courseRoadmap,
  };
};

async function getAgent(id: string): Promise<AgentRecord> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return buildFallbackAgent(id);
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

  const parentTemplateId =
    data && typeof data.parent_template_id === "string"
      ? data.parent_template_id
      : null;

  let blueprint: BlueprintRecord | null = null;
  if (parentTemplateId) {
    const { data: blueprintData, error: blueprintError } = await supabase
      .from("agent_blueprints")
      .select("id, logic_template, ai_model_config")
      .eq("id", parentTemplateId)
      .maybeSingle();

    if (blueprintError) {
      console.error("Fehler beim Laden des Blueprints:", blueprintError);
    } else if (blueprintData) {
      blueprint = {
        id: blueprintData.id,
        logic_template:
          typeof blueprintData.logic_template === "string"
            ? blueprintData.logic_template
            : null,
        ai_model_config: toAiModelConfig(blueprintData.ai_model_config),
      };
    }
  }

  return toAgentRecord({
    value: data,
    blueprint,
    id,
  });
}

export default async function ZasterixChatPage({ params }: ChatPageProps) {
  const agent = await getAgent(params.id);

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#0b141a] text-[#e9edef] select-none">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-[#222d34] bg-[#111b21] md:flex">
        <div className="flex h-16 items-center border-b border-[#222d34] bg-[#202c33] px-6">
          <span className="text-sm font-black uppercase tracking-[0.5em]">Zasterix</span>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#111b21]">{/* Deine Agenten-Liste */}</div>
      </aside>

      <main className="relative flex h-full w-full flex-1 flex-col bg-[#0b141a]">
        <header
          className="h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 bg-black"
          aria-hidden="true"
        />

        <ChatWindow agent={agent} />
      </main>
    </div>
  );
}

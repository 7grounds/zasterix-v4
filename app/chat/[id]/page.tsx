/**
 * @MODULE_ID app.chat.agent
 * @STAGE admin
 * @DATA_INPUTS ["agent_templates", "chat_messages"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import { createClient } from "@supabase/supabase-js";
import ChatInterface from "./ChatInterface";

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
  systemPrompt: string;
  system_prompt: string;
  courseRoadmap: CourseStep[];
  course_roadmap: CourseStep[];
};

type CourseStep = {
  id: number | string;
  title: string;
  status: string;
  type?: string;
  content?: string | null;
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

const toAgentRecord = (value: unknown, id: string): AgentRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const fallbackPrompt =
      "Du bist ein professioneller Agent der Zasterix-Organisation.";
    return {
      id,
      name: "Unbekannter Agent",
      level: 0,
      category: "System",
      systemPrompt: fallbackPrompt,
      system_prompt: fallbackPrompt,
      courseRoadmap: [],
      course_roadmap: [],
    };
  }

  const record = value as Record<string, unknown>;
  const systemPrompt =
    typeof record.system_prompt === "string"
      ? record.system_prompt
      : "Du bist ein professioneller Agent der Zasterix-Organisation.";
  const courseRoadmap = toCourseRoadmap(record.course_roadmap);

  return {
    id: typeof record.id === "string" ? record.id : id,
    name: typeof record.name === "string" ? record.name : "Unbekannter Agent",
    level: normalizeLevel(record.level),
    category: typeof record.category === "string" ? record.category : "System",
    systemPrompt,
    system_prompt: systemPrompt,
    courseRoadmap,
    course_roadmap: courseRoadmap,
  };
};

async function getAgent(id: string): Promise<AgentRecord> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const fallbackPrompt =
      "Du bist ein professioneller Agent der Zasterix-Organisation.";
    return {
      id,
      name: "Unbekannter Agent",
      level: 0,
      category: "System",
      systemPrompt: fallbackPrompt,
      system_prompt: fallbackPrompt,
      courseRoadmap: [],
      course_roadmap: [],
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

        <ChatInterface agent={agent} />
      </main>
    </div>
  );
}

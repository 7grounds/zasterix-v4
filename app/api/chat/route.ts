/**
 * @MODULE_ID app.api.chat
 * @STAGE admin
 * @DATA_INPUTS ["message", "agentId", "systemPrompt", "history", "hiddenInstruction"]
 * @REQUIRED_TOOLS ["openai", "supabase-js"]
 */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
};

type ChatHistoryEntry = {
  role: "system" | "user" | "assistant";
  content: string;
};

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

      if (
        (typeof id !== "number" && typeof id !== "string") ||
        typeof title !== "string" ||
        typeof status !== "string"
      ) {
        return null;
      }

      return { id, title, status };
    })
    .filter((step): step is CourseStep => Boolean(step));

  return parsed.length > 0 ? parsed : null;
};

export async function POST(req: Request) {
  try {
    const { message, agentId, systemPrompt, agentName, history, hiddenInstruction } =
      (await req.json()) as {
      message?: string;
      agentId?: string;
      systemPrompt?: string;
      agentName?: string;
      history?: ChatHistoryEntry[];
      hiddenInstruction?: string;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Nachricht fehlt." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY fehlt." }, { status: 500 });
    }

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
    `;

    const resolvedSystemPrompt =
      systemPrompt ||
      `Du bist ein professioneller Agent der Zasterix-Organisation.${
        agentName ? ` Name: ${agentName}.` : ""
      }`;
    const hiddenSystemInstruction =
      typeof hiddenInstruction === "string" && hiddenInstruction.trim().length > 0
        ? hiddenInstruction.trim()
        : null;

    const normalizedMessage = message.trim();

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

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Oder dein bevorzugtes Modell
      messages: [
        {
          role: "system",
          content: [
            resolvedSystemPrompt,
            globalInstruction,
            hiddenSystemInstruction
              ? `VERSTECKTER UNTERRICHTSBEFEHL:\n${hiddenSystemInstruction}`
              : null,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
        ...historyWithCurrentMessage,
      ],
    });

    const aiContent = response.choices[0]?.message?.content ?? "";

    const courseJsonMatch = aiContent.match(
      /COURSE_JSON_START([\s\S]*?)COURSE_JSON_END/,
    );
    let roadmapPayload: CourseStep[] | null = null;
    let completedStepIds: number[] = [];

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
      message,
      roadmapPayload ?? [],
    );
    completedStepIds = Array.from(
      new Set([...completionMarkersFromAi, ...completionMarkersFromUser]),
    );

    if (agentId && completedStepIds.length > 0) {
      let baseRoadmap = roadmapPayload ?? null;

      if (!baseRoadmap && supabaseAdmin) {
        const { data: agentData, error: agentLoadError } = await supabaseAdmin
          .from("agent_templates")
          .select("course_roadmap")
          .eq("id", agentId)
          .maybeSingle();

        if (agentLoadError) {
          console.error("Roadmap load error:", agentLoadError);
        } else {
          baseRoadmap = toCourseRoadmap(agentData?.course_roadmap) ?? null;
        }
      }

      if (baseRoadmap && baseRoadmap.length > 0) {
        // Requested behavior: update with agent.course_roadmap.map(...)
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

    const cleanText = aiContent
      .replace(/COURSE_JSON_START[\s\S]*?COURSE_JSON_END/g, "")
      .replace(/UPDATE_STEP_\d+_COMPLETED/g, "")
      .trim();
    return NextResponse.json({
      text: cleanText,
      roadmap: roadmapPayload,
      completedStepIds,
    });
  } catch (error: unknown) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

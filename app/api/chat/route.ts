/**
 * @MODULE_ID app.api.chat
 * @STAGE admin
 * @DATA_INPUTS ["message", "agentId", "systemPrompt", "history", "hiddenInstruction", "stream"]
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

const sanitizeAssistantContent = (value: string) =>
  value
    .replace(/COURSE_JSON_START[\s\S]*?COURSE_JSON_END/g, "")
    .replace(/UPDATE_STEP_\d+_COMPLETED/g, "");

const sanitizeAssistantContentPartial = (value: string) => {
  let cleaned = sanitizeAssistantContent(value);
  const openCourseBlockIndex = cleaned.lastIndexOf("COURSE_JSON_START");
  if (openCourseBlockIndex !== -1) {
    cleaned = cleaned.slice(0, openCourseBlockIndex);
  }
  return cleaned.replace(/UPDATE_STEP_[\d_]*$/g, "");
};

const finalizeAiPayload = async ({
  aiContent,
  userMessage,
  agentId,
}: {
  aiContent: string;
  userMessage: string;
  agentId?: string;
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
    } =
      (await req.json()) as {
      message?: string;
      agentId?: string;
      systemPrompt?: string;
      agentName?: string;
      history?: ChatHistoryEntry[];
      hiddenInstruction?: string;
      stream?: boolean;
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
    const shouldStream = Boolean(stream);

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
          globalInstruction,
          hiddenSystemInstruction
            ? `VERSTECKTER UNTERRICHTSBEFEHL:\n${hiddenSystemInstruction}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      ...historyWithCurrentMessage,
    ];

    if (shouldStream) {
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        start(controller) {
          const sendEvent = (event: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          };

          const run = async () => {
            try {
              const completionStream = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: requestMessages,
                stream: true,
              });

              let aiContent = "";
              let visibleLength = 0;

              for await (const chunk of completionStream) {
                const deltaText = chunk.choices[0]?.delta?.content;
                if (typeof deltaText !== "string" || deltaText.length === 0) {
                  continue;
                }

                aiContent += deltaText;
                const visibleText = sanitizeAssistantContentPartial(aiContent);
                const nextChunk = visibleText.slice(visibleLength);
                if (nextChunk.length > 0) {
                  visibleLength = visibleText.length;
                  sendEvent({ type: "chunk", text: nextChunk });
                }
              }

              const finalized = await finalizeAiPayload({
                aiContent,
                userMessage: normalizedMessage,
                agentId,
              });
              sendEvent({ type: "final_text", text: finalized.cleanText });
              sendEvent({
                type: "meta",
                roadmap: finalized.roadmapPayload,
                completedStepIds: finalized.completedStepIds,
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
        },
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: requestMessages,
    });

    const aiContent = response.choices[0]?.message?.content ?? "";
    const finalized = await finalizeAiPayload({
      aiContent,
      userMessage: normalizedMessage,
      agentId,
    });
    return NextResponse.json({
      text: finalized.cleanText,
      roadmap: finalized.roadmapPayload,
      completedStepIds: finalized.completedStepIds,
    });
  } catch (error: unknown) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

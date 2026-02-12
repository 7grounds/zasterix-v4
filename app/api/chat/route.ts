/**
 * @MODULE_ID app.api.chat
 * @STAGE admin
 * @DATA_INPUTS ["message", "agentId", "systemPrompt", "history", "hiddenInstruction", "stream", "autoFillStep", "roadmapSnapshot"]
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
    const requestedAutoFillStep = toAutoFillStep(autoFillStep);
    const snapshotRoadmap = toCourseRoadmap(roadmapSnapshot);
    let roadmapForAutoFill = snapshotRoadmap;
    if (requestedAutoFillStep && agentId) {
      const dbRoadmap = await loadAgentRoadmap(agentId);
      if (dbRoadmap && dbRoadmap.length > 0) {
        roadmapForAutoFill = dbRoadmap;
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
    const effectiveHiddenSystemInstruction = [hiddenSystemInstruction, autoFillInstruction]
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
              sendEvent({ type: "final_text", text: finalized.cleanText });
              sendEvent({
                type: "meta",
                roadmap: roadmapWithGeneratedContent,
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
    return NextResponse.json({
      text: finalized.cleanText,
      roadmap: roadmapWithGeneratedContent,
      completedStepIds: finalized.completedStepIds,
    });
  } catch (error: unknown) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

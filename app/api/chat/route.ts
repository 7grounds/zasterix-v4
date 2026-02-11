/**
 * @MODULE_ID app.api.chat
 * @STAGE admin
 * @DATA_INPUTS ["message", "agentId", "systemPrompt"]
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
    const { message, agentId, systemPrompt, agentName } = (await req.json()) as {
      message?: string;
      agentId?: string;
      systemPrompt?: string;
      agentName?: string;
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
      markiere dieses Modul als erledigt und fuege am ENDE der Antwort EXAKT den Marker hinzu:
      UPDATE_STEP_[ID]_COMPLETED
      (Beispiel: UPDATE_STEP_2_COMPLETED)
    `;

    const resolvedSystemPrompt =
      systemPrompt ||
      `Du bist ein professioneller Agent der Zasterix-Organisation.${
        agentName ? ` Name: ${agentName}.` : ""
      }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Oder dein bevorzugtes Modell
      messages: [
        {
          role: "system",
          content: `${resolvedSystemPrompt}\n\n${globalInstruction}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const aiContent = response.choices[0]?.message?.content ?? "";

    const courseJsonMatch = aiContent.match(/COURSE_JSON_START([\s\S]*?)COURSE_JSON_END/);
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

    const completedStepIds = Array.from(
      aiContent.matchAll(/UPDATE_STEP_(\d+)_COMPLETED/g),
      (match) => Number(match[1]),
    ).filter((id) => Number.isFinite(id));

    if (completedStepIds.length > 0 && agentId) {
      if (supabaseAdmin) {
        const { data: agentData, error: agentError } = await supabaseAdmin
          .from("agent_templates")
          .select("course_roadmap")
          .eq("id", agentId)
          .maybeSingle();

        if (agentError) {
          console.error("Roadmap load error:", agentError);
        } else if (agentData) {
          const agent = {
            course_roadmap: toCourseRoadmap(agentData.course_roadmap) ?? [],
          };

          // Requested behavior: update with agent.course_roadmap.map(...)
          const updatedRoadmap = agent.course_roadmap.map((step) => {
            const stepId =
              typeof step.id === "number" ? step.id : Number.parseInt(step.id, 10);
            if (Number.isFinite(stepId) && completedStepIds.includes(stepId)) {
              return { ...step, status: "completed" as const };
            }
            return step;
          });

          const { error: updateStepError } = await supabaseAdmin
            .from("agent_templates")
            .update({ course_roadmap: updatedRoadmap })
            .eq("id", agentId);

          if (updateStepError) {
            console.error("Roadmap completion update error:", updateStepError);
          } else if (updatedRoadmap.length > 0) {
            roadmapPayload = updatedRoadmap;
          }
        }
      } else {
        console.warn(
          "SUPABASE_SERVICE_ROLE_KEY missing. Completion marker update skipped.",
        );
      }
    }

    const cleanText = aiContent
      .replace(/COURSE_JSON_START[\s\S]*?COURSE_JSON_END/g, "")
      .replace(/UPDATE_STEP_\d+_COMPLETED/g, "")
      .trim();
    return NextResponse.json({ text: cleanText, roadmap: roadmapPayload });
  } catch (error: unknown) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

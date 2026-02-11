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

    const courseJsonMatch = aiContent.match(
      /COURSE_JSON_START([\s\S]*?)COURSE_JSON_END/,
    );

    if (courseJsonMatch && supabaseAdmin && agentId) {
      try {
        const parsedJson = JSON.parse(courseJsonMatch[1].trim()) as unknown;
        const roadmapData = toCourseRoadmap(parsedJson);

        if (roadmapData) {
          const { error: updateError } = await supabaseAdmin
            .from("agent_templates")
            .update({ course_roadmap: roadmapData })
            .eq("id", agentId);

          if (updateError) {
            console.error("Roadmap update error:", updateError);
          }
        }
      } catch (parseError: unknown) {
        console.error("Parsing Error", parseError);
      }
    }

    const cleanText = aiContent.split("COURSE_JSON_START")[0].trim();
    return NextResponse.json({ text: cleanText });
  } catch (error: unknown) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

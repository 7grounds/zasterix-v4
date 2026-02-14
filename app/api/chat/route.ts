import { NextResponse } from "next/server";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createClient } from "@supabase/supabase-js";

const openaiFactory = process.env.OPENAI_API_KEY ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const groqFactory = process.env.GROQ_API_KEY ? createGroq({ apiKey: process.env.GROQ_API_KEY }) : null;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resolveModelFactory = (provider: string) => {
  const p = provider.toLowerCase();
  if (p === "groq" || p === "grok") return groqFactory;
  return openaiFactory;
};

const sanitizeMarkers = (text: string) => {
  return text
    .replace(/COURSE_JSON_START[\s\S]*?COURSE_JSON_END/g, "")
    .replace(/VALIDATION_TYPE_[A-Za-z0-9_-]+/g, "")
    .replace(/UPDATE_STEP_\d+_COMPLETED/g, "")
    .trim();
};

export async function POST(req: Request) {
  try {
    const { message, agentId, history = [], systemPrompt: overridePrompt, aiModelConfig: overrideConfig, stream = false } = await req.json();

    if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const { data: dbAgent } = agentId 
      ? await supabaseAdmin.from("agent_templates").select("*").eq("id", agentId).single()
      : { data: null };
    
    const config = dbAgent?.ai_model_config || overrideConfig || {};
    const provider = config.provider || "groq";
    const modelName = config.model || "llama-3.3-70b-versatile";
    
    const factory = resolveModelFactory(provider);
    if (!factory) throw new Error(`Provider ${provider} not configured`);
    const aiModel = factory(modelName);

    const fullSystemPrompt = [
      overridePrompt || dbAgent?.system_prompt || "You are an Origo Agent.",
      dbAgent?.validation_library?.length > 0 ? `VALIDATION_LIBRARY: ${JSON.stringify(dbAgent.validation_library)}` : ""
    ].filter(Boolean).join("\n\n");

    const requestMessages = [
      { role: "system" as const, content: fullSystemPrompt },
      ...history,
      { role: "user" as const, content: message },
    ];

    if (stream) {
      const result = await streamText({ model: aiModel, messages: requestMessages, temperature: config.temperature ?? 0.7 });
      return result.toDataStreamResponse();
    }

    const { text } = await generateText({ model: aiModel, messages: requestMessages, temperature: config.temperature ?? 0.7 });
    return NextResponse.json({ text: sanitizeMarkers(text) });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


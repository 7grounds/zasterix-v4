/**
 * @MODULE_ID app.api.chat
 * @VERSION Origo-V4 (Hybrid: Teacher + Discussion)
 * @DATA_INPUTS ["message", "agentId", "aiModelConfig", "history", "systemPrompt"]
 */
import { NextResponse } from "next/server";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createClient } from "@supabase/supabase-js";

// --- 1. FACTORY INITIALIZATION ---
const openaiFactory = process.env.OPENAI_API_KEY ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const groqFactory = process.env.GROQ_API_KEY ? createGroq({ apiKey: process.env.GROQ_API_KEY }) : null;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- 2. DATA-DRIVEN HELPERS ---

const resolveModelFactory = (provider: string) => {
  if (provider.toLowerCase() === "groq") return groqFactory;
  return openaiFactory;
};

const loadAgentConfig = async (agentId: string) => {
  const { data, error } = await supabaseAdmin
    .from("agent_templates")
    .select("ai_model_config, validation_library, system_prompt, course_roadmap")
    .eq("id", agentId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
};

// Minimalist Marker Sanitization
const sanitizeMarkers = (text: string) => {
  return text
    .replace(/COURSE_JSON_START[\s\S]*?COURSE_JSON_END/g, "")
    .replace(/VALIDATION_TYPE_[A-Za-z0-9_-]+/g, "")
    .replace(/UPDATE_STEP_\d+_COMPLETED/g, "")
    .trim();
};

// --- 3. MAIN ROUTE HANDLER ---

export async function POST(req: Request) {
  try {
    const {
      message,
      agentId,
      history = [],
      systemPrompt: overridePrompt,
      aiModelConfig: overrideConfig,
      stream = false,
    } = await req.json();

    if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    // A. FETCH AGENT CONTEXT FROM DB
    const dbAgent = agentId ? await loadAgentConfig(agentId) : null;
    
    // B. RESOLVE MODEL CONFIG
    const config = dbAgent?.ai_model_config || overrideConfig || {};
    const provider = config.provider || "groq";
    const modelName = config.model || "llama-3.3-70b-versatile";
    
    const factory = resolveModelFactory(provider);
    if (!factory) throw new Error(`Provider ${provider} not configured`);
    const aiModel = factory(modelName);

    // C. CONSTRUCT DYNAMIC INSTRUCTIONS (Teacher Logic in DB)
    const validationLibrary = dbAgent?.validation_library || [];
    const validationInstruction = validationLibrary.length > 0 
      ? `VALIDATION_LIBRARY: ${JSON.stringify(validationLibrary)}. If a module changes, output: VALIDATION_TYPE_[TYPE].`
      : "";

    const fullSystemPrompt = [
      overridePrompt || dbAgent?.system_prompt || "You are an Origo Agent.",
      validationInstruction,
      "Answer clearly and maintain protocol."
    ].filter(Boolean).join("\n\n");

    const requestMessages = [
      { role: "system", content: fullSystemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    // D. EXECUTION (STREAMING OR STATIC)
    if (stream) {
      const result = await streamText({
        model: aiModel,
        messages: requestMessages,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.max_tokens ?? 1024,
      });

      return result.toDataStreamResponse();
    } else {
      const { text } = await generateText({
        model: aiModel,
        messages: requestMessages,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.max_tokens ?? 1024,
      });

      // E. DATA PERSISTENCE (Optional: Update roadmap if markers found)
      // Note: Minimalist approach, only cleanup markers for the UI
      const cleanText = sanitizeMarkers(text);

      return NextResponse.json({
        text: cleanText,
        raw: text // Keep markers hidden in raw for potential frontend parsers
      });
    }

  } catch (error: any) {
    console.error("Origo API Error:", error.message);
    return NextResponse.json({ error: "Communication Failed", details: error.message }, { status: 500 });
  }
}

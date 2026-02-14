/**
 * @MODULE_ID app.api.chat
 * @VERSION Origo-V4-xAI-Linter-Fix
 */
import { NextResponse } from "next/server";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";

const xai = createOpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, agentId, history = [], stream = false } = await req.json();

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "XAI_API_KEY missing" }, { status: 500 });
    }

    const { data: dbAgent } = agentId 
      ? await supabaseAdmin.from("agent_templates").select("*").eq("id", agentId).single()
      : { data: null };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agent = dbAgent as any;
    
    const modelName = agent?.ai_model_config?.model || "grok-2-1212";

    const requestMessages = [
      { role: "system" as const, content: agent?.system_prompt || "You are an Origo Agent." },
      ...history,
      { role: "user" as const, content: message },
    ];

    if (stream) {
      const result = await streamText({
        model: xai(modelName),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: requestMessages as any,
        temperature: 0.7,
      });
      return result.toTextStreamResponse();
    }

    const { text } = await generateText({
      model: xai(modelName),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: requestMessages as any,
      temperature: 0.7,
    });

    return NextResponse.json({ text });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

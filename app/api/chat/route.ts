/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @MODULE_ID app.api.chat
 * @VERSION Origo-V4-Universal-Switch
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, agentId, history = [] } = await req.json();

    // 1. Hol die Konfiguration für DIESEN Agenten aus der DB
    const { data: agent } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name")
      .eq("id", agentId)
      .single();

    if (!agent) return NextResponse.json({ error: "Agent nicht in DB" }, { status: 404 });

    // 2. Setup für den gewählten Provider (Groq oder xAI)
    const isGroq = agent.provider?.toLowerCase() === 'groq';
    
    const config = {
      url: isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions",
      key: isGroq ? process.env.GROQ_API_KEY : process.env.XAI_API_KEY,
      model: agent.model_name || (isGroq ? "llama-3.3-70b-versatile" : "grok-4")
    };

    if (!config.key) {
      return NextResponse.json({ error: `API Key für ${agent.provider} fehlt in Vercel` }, { status: 500 });
    }

    // 3. Der Request (beide nutzen das OpenAI-Format)
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.key.trim()}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: agent.system_prompt },
          ...history.filter((h: any) => h.content),
          { role: "user", content: message }
        ],
        temperature: 0.7
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: `${agent.provider} Error`, details: data }, { status: 400 });
    }

    return NextResponse.json({ 
      text: data.choices[0].message.content,
      active_model: config.model,
      active_provider: agent.provider
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Route Failure", msg: error.message }, { status: 500 });
  }
}

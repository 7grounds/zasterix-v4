/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    const { data: agent } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name, name")
      .eq("name", "Discussion Leader")
      .single();

    if (!agent) return NextResponse.json({ error: "Agent nicht gefunden" }, { status: 404 });

    const agentData = agent as any;
    // Normalisierung: 'grok' oder 'xai' -> xAI Gateway | 'groq' -> Groq Gateway
    const rawProvider = agentData.provider?.toLowerCase() || 'xai';
    const isGroq = rawProvider === 'groq';
    
    const config = {
      url: isGroq 
        ? "https://api.groq.com/openai/v1/chat/completions" 
        : "https://api.x.ai/v1/chat/completions",
      key: isGroq 
        ? process.env.GROQ_API_KEY 
        : process.env.XAI_API_KEY,
      model: agentData.model_name
    };

    if (!config.key) return NextResponse.json({ error: `Key für ${rawProvider} fehlt` }, { status: 500 });

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.key.trim()}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: agentData.system_prompt },
          ...history.filter((h: any) => h.content),
          { role: "user", content: message }
        ],
        temperature: 0.7
      }),
    });

    const data = await response.json();
    return NextResponse.json({ 
      text: data.choices[0].message.content,
      metadata: { provider: rawProvider, model: config.model }
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Crash", msg: error.message }, { status: 500 });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, agentId, history = [] } = await req.json();

    // 1. Daten holen - wir laden alle relevanten Felder
    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name, name")
      .eq("id", agentId)
      .single();

    if (dbError || !agent) {
      return NextResponse.json({ error: "Agent nicht gefunden" }, { status: 404 });
    }

    // Wir casten agent zu any, um den TS-Error bei agent.name zu unterdrücken
    const agentData = agent as any;

    const provider = agentData.provider?.toLowerCase() || 'xai';
    const isGroq = provider === 'groq';
    
    const config = {
      url: isGroq 
        ? "https://api.groq.com/openai/v1/chat/completions" 
        : "https://api.x.ai/v1/chat/completions",
      key: isGroq 
        ? process.env.GROQ_API_KEY 
        : process.env.XAI_API_KEY,
      model: agentData.model_name || (isGroq ? "llama-3.3-70b-versatile" : "grok-4")
    };

    if (!config.key) {
      return NextResponse.json({ error: `Key für ${provider} fehlt` }, { status: 500 });
    }

    const cleanHistory = (history || []).filter(
      (h: any) => h.content && String(h.content).trim() !== ""
    );

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.key.trim()}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: agentData.system_prompt || "Origo Agent" },
          ...cleanHistory,
          { role: "user", content: message }
        ],
        temperature: 0.7
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "API_ERROR", details: data }, { status: 400 });
    }

    return NextResponse.json({ 
      text: data.choices[0].message.content,
      metadata: {
        provider: provider,
        model: config.model,
        agentName: agentData.name // Durch das casting auf 'any' geht der Build jetzt durch
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: "CRASH", msg: error.message }, { status: 500 });
  }
}

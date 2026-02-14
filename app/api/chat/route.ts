/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @MODULE_ID app.api.chat
 * @VERSION Origo-V4-Clean-Build
 * @DESCRIPTION Minimalistische Route für L1/L2 Hierarchie. Build-safe für Vercel.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, history = [], targetTitle = "Discussion Leader" } = await req.json();

    // 1. DYNAMISCHE IDENTITÄT: Holt L1 oder L2 Konfiguration aus Supabase
    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name, name")
      .eq("name", targetTitle)
      .single();

    if (dbError || !agent) {
      return NextResponse.json({ error: "Agent Title not found" }, { status: 404 });
    }

    // 2. PROVIDER GATEWAY: Groq (LPU Speed) oder xAI (Reasoning)
    const provider = agent.provider?.toLowerCase() || 'xai';
    const isGroq = provider === 'groq';
    
    const config = {
      url: isGroq 
        ? "https://api.groq.com/openai/v1/chat/completions" 
        : "https://api.x.ai/v1/chat/completions",
      key: isGroq ? process.env.GROQ_API_KEY : process.env.XAI_API_KEY,
      model: agent.model_name
    };

    if (!config.key) {
      return NextResponse.json({ error: `API Key missing for ${provider}` }, { status: 500 });
    }

    // 3. MINIMALISTISCHER REQUEST: Fokus auf Kürze und Identität
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.key.trim()}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { 
            role: "system", 
            content: `${agent.system_prompt} Antworte IMMER im Format [${agent.name}]: Text. Max 2 Sätze.` 
          },
          ...history.slice(-3), // Historie-Kürzung gegen Bloat
          { role: "user", content: message }
        ],
        temperature: 0.6,
        max_tokens: 120 // Harte Grenze für kompakten Style
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "Provider Error", details: data }, { status: 400 });
    }

    // 4. RESPONSE: Rückgabe an Origo UI
    return NextResponse.json({ 
      text: data.choices[0].message.content,
      metadata: {
        title: agent.name,
        provider: provider
      }
    });

  } catch {
    // ESLint-safe: Keine ungenutzten Variablen mehr
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

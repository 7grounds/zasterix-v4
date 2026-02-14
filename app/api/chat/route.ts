/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @MODULE_ID app.api.chat
 * @VERSION Origo-V4-Dynamic-Lookup
 * @DESCRIPTION Sucht Agenten nach Name und nutzt dessen DB-Konfiguration für Groq oder xAI.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    // 1. DYNAMISCHE SUCHE: Wir holen uns die Config für den Discussion Leader
    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name, name")
      .eq("name", "Discussion Leader")
      .single();

    if (dbError || !agent) {
      return NextResponse.json({ 
        error: "Agent 'Discussion Leader' nicht gefunden.", 
        details: dbError 
      }, { status: 404 });
    }

    const agentData = agent as any;
    const rawProvider = agentData.provider?.toLowerCase() || 'xai';
    
    // 2. GATEWAY-LOGIK: Mapping zwischen DB-Eintrag und API-Endpunkt
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

    if (!config.key) {
      return NextResponse.json({ error: `API Key für ${rawProvider} fehlt in Vercel` }, { status: 500 });
    }

    // 3. PAYLOAD: OpenAI-kompatibles Format für beide Provider
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
          ...history.filter((h: any) => h.content && h.content.trim() !== ""),
          { role: "user", content: message }
        ],
        temperature: 0.7
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: "GATEWAY_ERROR", details: data }, { status: 400 });
    }

    // 4. RESPONSE: Rückgabe an dein Frontend
    return NextResponse.json({ 
      text: data.choices[0].message.content,
      metadata: {
        provider: rawProvider,
        model: config.model,
        agent: agentData.name
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: "CRASH", msg: error.message }, { status: 500 });
  }
}

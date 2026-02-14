/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @MODULE_ID app.api.chat
 * @VERSION Origo-V4-Universal-Switch-Final
 * @DESCRIPTION Dynamisches Routing zwischen Groq und xAI basierend auf Supabase-Agenten-Config.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 1. Supabase Admin Client Initialisierung
// Benötigt NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, agentId, history = [] } = await req.json();

    // 2. DATEN-ABFRUFE: Konfiguration für diesen Agenten aus der DB laden
    // Wir holen den System-Prompt, den Provider (groq/xai) und den Modell-Namen
    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name")
      .eq("id", agentId)
      .single();

    if (dbError || !agent) {
      return NextResponse.json({ error: "Agent nicht gefunden" }, { status: 404 });
    }

    // 3. PROVIDER-LOGIK: Setup basierend auf dem Datenbank-Eintrag
    const provider = agent.provider?.toLowerCase() || 'xai';
    const isGroq = provider === 'groq';
    
    const config = {
      url: isGroq 
        ? "https://api.groq.com/openai/v1/chat/completions" 
        : "https://api.x.ai/v1/chat/completions",
      key: isGroq 
        ? process.env.GROQ_API_KEY 
        : process.env.XAI_API_KEY,
      model: agent.model_name || (isGroq ? "llama-3.3-70b-versatile" : "grok-4")
    };

    // Validierung: Ist der API-Key für den gewählten Provider vorhanden?
    if (!config.key) {
      return NextResponse.json({ 
        error: `API_KEY_MISSING`, 
        details: `Key für ${provider} nicht in Vercel hinterlegt.` 
      }, { status: 500 });
    }

    // 4. MESSAGES: Säuberung der Historie (XAI/Groq mögen keine leeren Inhalte)
    const cleanHistory = (history || []).filter(
      (h: any) => h.content && String(h.content).trim() !== ""
    );

    const payload = {
      model: config.model,
      messages: [
        { role: "system", content: agent.system_prompt || "You are an Origo Strategic Manager." },
        ...cleanHistory,
        { role: "user", content: message }
      ],
      temperature: 0.7,
      stream: false // Für maximale Stabilität im ersten Schritt
    };

    // 5. TRANSFER: Der Request an das KI-Gateway
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.key.trim()}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // 6. ERROR-HANDLING: Falls der Provider ablehnt (z.B. falsches Modell oder Key)
    if (!response.ok) {
      console.error(`${provider.toUpperCase()}_REJECTION:`, data);
      return NextResponse.json({ 
        error: `${provider.toUpperCase()}_API_ERROR`, 
        details: data.error?.message || data 
      }, { status: 400 });
    }

    // 7. OUTPUT: Rückgabe an das Origo-Frontend
    return NextResponse.json({ 
      text: data.choices[0].message.content,
      metadata: {
        provider: provider,
        model: config.model,
        agentName: agent.name
      }
    });

  } catch (error: any) {
    console.error("ORIGO_ROUTE_CRASH:", error.message);
    return NextResponse.json({ 
      error: "INTERNAL_SERVER_ERROR", 
      msg: error.message 
    }, { status: 500 });
  }
}

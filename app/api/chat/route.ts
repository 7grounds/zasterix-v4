/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @MODULE_ID app.api.chat
 * @VERSION Origo-V4-Grok4-Integrated
 * @STRICT_COMPLIANCE True
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 1. Initialize Supabase Admin for secure template fetching
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, agentId, history = [] } = await req.json();
    const apiKey = process.env.XAI_API_KEY;

    // Guard: Ensure API Key is present in Vercel
    if (!apiKey) {
      return NextResponse.json({ error: "XAI_API_KEY_MISSING" }, { status: 500 });
    }

    // 2. DATA LAYER: Fetch Agent Identity from Supabase
    // This transforms the 'dummy' diagnostic into your actual Discussion Leader
    const { data: agent } = await supabase
      .from("agent_templates")
      .select("system_prompt, name, ai_model_config")
      .eq("id", agentId)
      .single();

    // 3. SANITIZATION: Remove empty messages (Prevents xAI 400 errors)
    const cleanHistory = (history || []).filter(
      (m: any) => m.content && String(m.content).trim() !== ""
    );
    
    const messages = [
      { 
        role: "system", 
        content: agent?.system_prompt || "You are a professional Origo Strategic Agent." 
      },
      ...cleanHistory,
      { role: "user", content: message }
    ];

    // 4. PROTOCOL LAYER: The Direct xAI Handshake
    // We avoid the AI SDK here to ensure 'frequency_penalty' or other illegal params aren't injected
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "grok-4", // Forcing Grok 4 for strategic depth
        messages: messages,
        temperature: 0.7,
        stream: false
      }),
    });

    const data = await response.json();

    // 5. ERROR HANDLING: Capture rejection details
    if (!response.ok) {
      console.error("XAI_GATEWAY_REJECTION:", data);
      return NextResponse.json({ 
        error: "XAI_API_REFUSED", 
        details: data.error?.message || data 
      }, { status: 400 });
    }

    // 6. RESPONSE LAYER: Return to Origo UI
    return NextResponse.json({ 
      text: data.choices[0].message.content,
      agentName: agent?.name || "Origo Agent"
    });

  } catch (error: any) {
    console.error("ORIGO_ROUTE_CRASH:", error.message);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", msg: error.message }, { status: 500 });
  }
}


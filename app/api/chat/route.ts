/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @MODULE_ID app.api.chat
 * @VERSION Origo-V4-Pure-Titles
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { message, history = [], targetTitle = "Discussion Leader" } = await req.json();

    // 1. Suche via Titel (name-Spalte in DB)
    const { data: agent } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name, name")
      .eq("name", targetTitle)
      .single();

    if (!agent) return NextResponse.json({ error: "Title not found" }, { status: 404 });

    const isGroq = agent.provider === 'groq';
    const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.XAI_API_KEY;

    // 2. Request mit striktem Titel-Format
    const res = await fetch(isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey?.trim()}` },
      body: JSON.stringify({
        model: agent.model_name,
        messages: [
          { role: "system", content: `${agent.system_prompt} Antworte IMMER im Format [${agent.name}]: Text. Max 2 Sätze.` },
          ...history.slice(-3),
          { role: "user", content: message }
        ],
        temperature: 0.5,
        max_tokens: 100
      }),
    });

    const data = await res.json();
    return NextResponse.json({ 
      text: data.choices[0].message.content, 
      title: agent.name 
    });

  } catch (e: any) {
    return NextResponse.json({ error: "Fail" }, { status: 500 });
  }
}

        

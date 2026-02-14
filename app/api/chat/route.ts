/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, history = [], targetTitle = "Discussion Leader" } = await req.json();

    // 1. Fetch Agent including Metadata (Blueprint storage)
    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name, name, metadata")
      .eq("name", targetTitle)
      .single();

    if (dbError || !agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // 2. Blueprint Fallback Logic
    // If blueprint exists in metadata, we prioritize it as 'Experience'
    const blueprint = agent.metadata?.blueprint;
    const blueprintContext = blueprint 
      ? `\n[BLUEPRINT ENABLED]: Use the following learned keywords and project history to guide your response: ${JSON.stringify(blueprint.keywords)}.` 
      : "\n[TEMPLATE MODE]: No specific project blueprint found. Use your base instructions.";

    const isGroq = agent.provider?.toLowerCase() === 'groq';
    const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.XAI_API_KEY;
    const apiUrl = isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions";

    // 3. Execution with Combined Brain (Template + Blueprint)
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey?.trim()}`,
      },
      body: JSON.stringify({
        model: agent.model_name,
        messages: [
          { 
            role: "system", 
            content: `${agent.system_prompt}${blueprintContext}\nALWAYS respond in English. Format: [${agent.name}]: Text.` 
          },
          ...history.slice(-5),
          { role: "user", content: message }
        ],
        temperature: 0.4, // Lower temperature for higher precision (Serious Mode)
      }),
    });

    const data = await response.json();
    return NextResponse.json({ 
      text: data.choices[0].message.content,
      title: agent.name
    });

  } catch (err) {
    return NextResponse.json({ error: "Origo Execution Error" }, { status: 500 });
  }
}

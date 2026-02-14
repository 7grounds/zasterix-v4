import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, history = [], targetTitle = "Manager Alpha" } = await req.json();

    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("system_prompt, provider, model_name, name, metadata")
      .eq("name", targetTitle)
      .single();

    if (dbError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const blueprint = agent.metadata?.blueprint;
    const blueprintContext = blueprint 
      ? `\n[BLUEPRINT ACTIVE]: ${JSON.stringify(blueprint.keywords)}` 
      : "";

    const isGroq = agent.provider?.toLowerCase() === 'groq';
    const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.XAI_API_KEY;
    const apiUrl = isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.x.ai/v1/chat/completions";

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
            content: `${agent.system_prompt}${blueprintContext}\nAlways respond in English. Format: [${agent.name}]: Text.` 
          },
          ...history.slice(-6),
          { role: "user", content: message }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error("Invalid AI response");
    }

    return NextResponse.json({ 
      text: data.choices[0].message.content,
      title: agent.name
    });

  } catch {
    return NextResponse.json({ error: "Origo Brain Error" }, { status: 500 });
  }
}

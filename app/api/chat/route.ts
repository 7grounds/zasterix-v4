import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { 
      message, 
      history = [], 
      targetTitle = "Manager Alpha", 
      projectId 
    } = await req.json();

    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("id, name, system_prompt, provider, model_name, metadata, engine_type")
      .eq("name", targetTitle)
      .single();

    if (dbError || !agent) {
      return NextResponse.json({ error: "Agent nicht gefunden" }, { status: 404 });
    }

    const blueprint = agent.metadata?.blueprint;
    const blueprintContext = blueprint 
      ? `\n[BLUEPRINT ACTIVE]: ${JSON.stringify(blueprint.keywords)}` 
      : "";

    const isGroq = agent.provider?.toLowerCase() === 'groq';
    const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.XAI_API_KEY;
    const apiUrl = isGroq 
      ? "https://api.groq.com/openai/v1/chat/completions" 
      : "https://api.x.ai/v1/chat/completions";

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
            content: `${agent.system_prompt}${blueprintContext}\nAntworte auf Englisch. Format: [${agent.name}]: Text.` 
          },
          ...history.slice(-6),
          { role: "user", content: message }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;

    if (!aiContent) throw new Error("Provider Error");

    if (projectId) {
      await supabase.from("discussion_logs").insert({
        project_id: projectId,
        agent_id: agent.id,
        speaker_name: agent.name,
        content: aiContent,
        metadata: { engine: agent.engine_type, model: agent.model_name }
      });
    }

    return NextResponse.json({ text: aiContent, title: agent.name });

  } catch {
    return NextResponse.json({ error: "Origo Brain Error" }, { status: 500 });
  }
}


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { 
      message, 
      history = [], 
      targetTitle = "Manager Alpha", 
      projectId 
    } = await req.json();

    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("id, name, system_prompt, provider, model_name, engine_type")
      .eq("name", targetTitle)
      .single();

    if (dbError || !agent) {
      return NextResponse.json({ error: "Agent nicht gefunden" }, { status: 404 });
    }

    const isGroq = agent.provider?.toLowerCase() === 'groq';
    const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.XAI_API_KEY;
    const apiUrl = isGroq 
      ? "https://api.groq.com/openai/v1/chat/completions" 
      : "https://api.x.ai/v1/chat/completions";

    const customSystemPrompt = `
      ${agent.system_prompt}
      ---
      STRICT PROTOCOL:
      - PROJECT UUID: ${projectId}
      - TOPIC: Zasterix Dashboard Entwicklung
      - AGENTS: Designer, DevOps
      RULES:
      - Maximal 3 Zeilen pro Antwort.
      - Manager Alpha: Stelle UUID, Thema und Agenten zu Beginn vor.
      - Manager Alpha: Erstelle am Ende eine Zusammenfassung.
      - Sprache: Englisch. Format: [${agent.name}]: Text.
    `;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey?.trim()}`,
      },
      body: JSON.stringify({
        model: agent.model_name,
        messages: [
          { role: "system", content: customSystemPrompt },
          ...history.slice(-8),
          { role: "user", content: message }
        ],
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;

    if (!aiContent) throw new Error("Keine Antwort von KI");

    if (projectId) {
      await supabase.from("discussion_logs").insert({
        project_id: projectId,
        agent_id: agent.id,
        speaker_name: agent.name,
        content: aiContent
      });
    }

    return NextResponse.json({ text: aiContent, title: agent.name });

  } catch {
    return NextResponse.json({ error: "Origo Brain Error" }, { status: 500 });
  }
}

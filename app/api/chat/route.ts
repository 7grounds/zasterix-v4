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

    // 1. Agenten-Daten aus agent_templates laden
    const { data: agent, error: dbError } = await supabase
      .from("agent_templates")
      .select("id, name, system_prompt, provider, model_name, metadata")
      .eq("name", targetTitle)
      .single();

    if (dbError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // 2. Provider-Konfiguration
    const isGroq = agent.provider?.toLowerCase() === 'groq';
    const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.XAI_API_KEY;
    const apiUrl = isGroq 
      ? "https://api.groq.com/openai/v1/chat/completions" 
      : "https://api.x.ai/v1/chat/completions";

    // 3. System-Prompt Erweiterung für UUID & Regeln
    const customSystemPrompt = `
      ${agent.system_prompt}
      ---
      CONTEXT:
      - CURRENT PROJECT UUID: ${projectId}
      - TOPIC: Zasterix Dashboard & GitHub Integration
      - PARTICIPANTS: Manager Alpha, Designer, DevOps
      STRICT RULES:
      - Max 3 lines per response.
      - Manager Alpha must introduce UUID, Topic, and Agents at the start.
      - Manager Alpha must provide a summary at the end.
      - Respond in English. Format: [${agent.name}]: Text.
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
          ...history.slice(-8), // Berücksichtigt das total Gesagte
          { role: "user", content: message }
        ],
        temperature: 0.2, // Niedrige Temp für strikte Einhaltung der Regeln
      }),
    });

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content;

    if (!aiContent) throw new Error("Empty AI response");

    // 4. Logging in discussion_logs
    if (projectId) {
      await supabase.from("discussion_logs").insert({
        project_id: projectId,
        agent_id: agent.id,
        speaker_name: agent.name,
        content: aiContent,
        metadata: { model: agent.model_name }
      });
    }

    return NextResponse.json({ text: aiContent, title: agent.name });

  } catch {
    return NextResponse.json({ error: "Origo Brain Error" }, { status: 500 });
  }
}

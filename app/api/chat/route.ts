/**
 * @MODULE_ID app.api.chat
 * @STAGE admin
 * @DATA_INPUTS ["message", "systemPrompt", "agentName"]
 * @REQUIRED_TOOLS ["openai"]
 */
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, systemPrompt, agentName } = (await req.json()) as {
      message?: string;
      systemPrompt?: string;
      agentName?: string;
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Oder dein bevorzugtes Modell
      messages: [
        {
          role: "system",
          content:
            systemPrompt ||
            `Du bist ein professioneller Agent der Zasterix-Organisation.${agentName ? ` Name: ${agentName}.` : ""}`,
        },
        {
          role: "user",
          content: message ?? "",
        },
      ],
      temperature: 0.7,
    });

    const aiResponse = response.choices[0]?.message?.content ?? "";

    return NextResponse.json({ text: aiResponse });
  } catch (error: unknown) {
    console.error("Chat Error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Kommunikation mit dem Agenten" },
      { status: 500 },
    );
  }
}

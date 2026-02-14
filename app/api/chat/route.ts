/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "XAI_API_KEY is missing in Vercel." }, { status: 500 });
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "grok-4", // Using the stable production ID
        messages: [
          { role: "system", content: "You are a diagnostic assistant." },
          { role: "user", content: message || "Ping" }
        ],
        temperature: 0
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: "XAI_API_REFUSED", 
        details: data 
      }, { status: response.status });
    }

    return NextResponse.json({ text: data.choices[0].message.content });

  } catch (error: any) {
    return NextResponse.json({ error: "API_CRASH", msg: error.message }, { status: 500 });
  }
}

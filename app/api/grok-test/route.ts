/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // 1. Validate the Key
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "XAI_API_KEY is missing from Vercel variables." }, { status: 500 });

    // 2. Pure Fetch to xAI (No SDK interference)
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Model Aliases for Feb 2026: 'grok-4' or 'grok-4-fast-non-reasoning'
        model: "grok-4", 
        messages: [
          { role: "system", content: "You are a test assistant." },
          { role: "user", content: message }
        ],
        stream: false,
        temperature: 0
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: "xAI API Refused Request", 
        status: response.status,
        details: data 
      }, { status: response.status });
    }

    return NextResponse.json({ text: data.choices[0].message.content });

  } catch (error: any) {
    return NextResponse.json({ error: "Server Crash", message: error.message }, { status: 500 });
  }
}

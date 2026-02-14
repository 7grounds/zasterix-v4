/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "Missing XAI_API_KEY" }, { status: 500 });

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-2-1212", // The most stable ID for testing
        messages: [{ role: "user", content: message }],
        temperature: 0,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: "xAI Refused Request", 
        details: data 
      }, { status: response.status });
    }

    return NextResponse.json({ text: data.choices[0].message.content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

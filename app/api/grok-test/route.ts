/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const key = process.env.XAI_API_KEY;

    if (!key) return NextResponse.json({ error: "XAI_API_KEY_MISSING" }, { status: 500 });

    // We use the 'x' endpoint (xAI / Grok)
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key.trim()}`,
      },
      body: JSON.stringify({
        model: "grok-2-1212", 
        messages: [{ role: "user", content: message || "Ping" }],
        temperature: 0
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: "XAI_REJECTED_SIGNAL", 
        status: response.status,
        raw_error: data 
      }, { status: response.status });
    }

    return NextResponse.json({ 
      success: true, 
      text: data.choices[0].message.content 
    });

  } catch (error: any) {
    return NextResponse.json({ error: "INTERNAL_CRASH", msg: error.message }, { status: 500 });
  }
}

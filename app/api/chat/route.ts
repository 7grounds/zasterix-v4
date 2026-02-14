/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

// 1. Initialize xAI with NO extra configuration
const xai = createOpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "XAI_API_KEY missing" }, { status: 500 });
    }

    // 2. USE THE MOST STABLE MODEL NAME
    // Many accounts currently require 'grok-beta' or 'grok-2'
    const model = xai("grok-beta");

    // 3. GENERATE TEXT WITHOUT STREAMING (To avoid 'stream_options' errors)
    const { text } = await generateText({
      model: model,
      messages: [
        ...history,
        { role: "user", content: message }
      ],
      // REMOVE temperature/top_p for this test to ensure absolute compatibility
    });

    return NextResponse.json({ text });

  } catch (error: any) {
    // This will print the EXACT error from xAI in your Vercel logs
    console.error("XAI_DETAILED_ERROR:", error);
    return NextResponse.json({ 
      error: error.message || "Bad Request",
      details: error.data // This often contains the specific 'Argument not supported' message
    }, { status: 400 });
  }
}

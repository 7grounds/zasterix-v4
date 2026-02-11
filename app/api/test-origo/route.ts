/**
 * @MODULE_ID app.api.test-origo
 * @STAGE admin
 * @DATA_INPUTS ["openai_api", "universal_history"]
 * @REQUIRED_TOOLS ["openai", "supabase-js"]
 */
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_CHECK_PROMPT =
  "Origo System Check: Antworte mit 'Bereit fuer Zasterix-V4'.";

const buildErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

export async function GET() {
  try {
    const openAiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!openAiKey || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          status: "error",
          message: "Missing OPENAI_API_KEY or Supabase environment variables.",
        },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey: openAiKey });
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: SYSTEM_CHECK_PROMPT }],
    });

    const answer = completion.choices[0]?.message?.content ?? "No response";

    const { error: dbError } = await supabase.from("universal_history").insert({
      payload: {
        type: "system_test",
        source: "test-origo-route",
        response: answer,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      status: "success",
      openai_response: answer,
      supabase_logged: !dbError,
      supabase_error: dbError?.message ?? null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "error",
        message: buildErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

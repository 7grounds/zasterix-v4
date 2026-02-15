// Supabase Edge Function: Turn Controller
// Triggered by webhook on discussion_logs inserts
// Automatically calls next agent in sequence

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    project_id: string;
    agent_id: string;
    speaker_name: string;
    content: string;
    turn_index: number;
  };
  old_record: null;
}

interface NextSpeaker {
  agent_id: string | null;
  agent_name: string;
  sequence_order: number;
  system_prompt: string;
  is_user: boolean;
}

serve(async (req) => {
  try {
    // Parse webhook payload
    const payload: WebhookPayload = await req.json();
    
    console.log("Turn Controller triggered:", {
      type: payload.type,
      project_id: payload.record.project_id,
      turn_index: payload.record.turn_index,
    });

    // Ignore system messages (turn_index = -1)
    if (payload.record.turn_index === -1) {
      console.log("Ignoring system message");
      return new Response(
        JSON.stringify({ message: "System message ignored" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role (bypass RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get next speaker using SQL function
    const { data: nextSpeaker, error: speakerError } = await supabase
      .rpc("get_next_speaker", {
        p_project_id: payload.record.project_id,
      })
      .single();

    if (speakerError || !nextSpeaker) {
      console.error("Error getting next speaker:", speakerError);
      return new Response(
        JSON.stringify({ error: "Failed to get next speaker" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const speaker = nextSpeaker as NextSpeaker;

    // If next speaker is user, stop (wait for user input)
    if (speaker.is_user) {
      console.log("Next speaker is user, waiting for input");
      return new Response(
        JSON.stringify({ message: "Waiting for user input" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Next speaker:", {
      name: speaker.agent_name,
      sequence: speaker.sequence_order,
    });

    // Get discussion context (last 10 messages)
    const { data: context, error: contextError } = await supabase
      .from("discussion_logs")
      .select("speaker_name, content")
      .eq("project_id", payload.record.project_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (contextError) {
      console.error("Error fetching context:", contextError);
    }

    // Build context string
    const contextMessages = context
      ?.reverse()
      .map((msg) => `${msg.speaker_name}: ${msg.content}`)
      .join("\n\n") || "";

    // Call AI API (try Claude first, fallback to Groq)
    let aiResponse = "";
    let providerUsed = "";

    // Try Claude (Anthropic)
    if (ANTHROPIC_API_KEY) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: `${speaker.system_prompt}\n\nPrevious conversation:\n${contextMessages}\n\nRespond as ${speaker.agent_name}. Keep your response to 3 lines or less.`,
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiResponse = data.content[0].text;
          providerUsed = "anthropic";
          console.log("Claude response received");
        }
      } catch (error) {
        console.error("Claude API error:", error);
      }
    }

    // Fallback to Groq if Claude failed
    if (!aiResponse && GROQ_API_KEY) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              {
                role: "system",
                content: speaker.system_prompt,
              },
              {
                role: "user",
                content: `Previous conversation:\n${contextMessages}\n\nRespond as ${speaker.agent_name}. Keep your response to 3 lines or less.`,
              },
            ],
            max_tokens: 512,
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiResponse = data.choices[0].message.content;
          providerUsed = "groq";
          console.log("Groq response received");
        }
      } catch (error) {
        console.error("Groq API error:", error);
      }
    }

    if (!aiResponse) {
      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert agent response to discussion_logs
    const { error: insertError } = await supabase
      .from("discussion_logs")
      .insert({
        project_id: payload.record.project_id,
        agent_id: speaker.agent_id,
        speaker_name: speaker.agent_name,
        content: aiResponse,
        turn_index: payload.record.turn_index + 1,
      });

    if (insertError) {
      console.error("Error inserting response:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert response" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Response inserted successfully");

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        speaker: speaker.agent_name,
        sequence_order: speaker.sequence_order,
        provider: providerUsed,
        turn_index: payload.record.turn_index + 1,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Turn Controller error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * @MODULE_ID app.api.discussions.id.participants
 * @STAGE discussion
 * @DATA_INPUTS ["discussion_participants", "agent_templates"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: {
    id: string;
  };
};

const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase configuration missing");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const projectId = context.params.id;
    const supabase = createSupabaseAdmin();

    // Fetch participants with agent template details
    const { data: participants, error: participantsError } = await supabase
      .from("discussion_participants")
      .select(`
        id,
        role,
        sequence_order,
        agent_id,
        agent_templates (
          id,
          name,
          discipline,
          category,
          level
        )
      `)
      .eq("project_id", projectId)
      .order("sequence_order", { ascending: true });

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    // Transform the data to flatten the nested structure
    const formattedParticipants = (participants ?? []).map((p: {
      id: string;
      role: string;
      sequence_order: number;
      agent_id: string | null;
      agent_templates: {
        id: string;
        name: string;
        discipline: string | null;
        category: string | null;
        level: number | null;
      }[] | null;
    }) => ({
      id: p.id,
      role: p.role,
      sequence_order: p.sequence_order,
      agent_id: p.agent_id,
      name: p.agent_templates?.[0]?.name || "User",
      discipline: p.agent_templates?.[0]?.discipline || "N/A",
      category: p.agent_templates?.[0]?.category || "N/A",
      level: p.agent_templates?.[0]?.level || 0,
    }));

    return NextResponse.json({
      status: "success",
      participants: formattedParticipants,
      count: formattedParticipants.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not load participants",
      },
      { status: 500 }
    );
  }
}

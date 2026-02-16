/**
 * @MODULE_ID app.api.projects.init
 * @STAGE project-initialization
 * @DATA_INPUTS ["project_name", "user_id", "organization_id"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProjectInitRequest = {
  name: string;
  userId?: string;
  organizationId?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { status: "error", message: "Supabase credentials not configured." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = (await req.json()) as ProjectInitRequest;
    const projectName = typeof body.name === "string" ? body.name.trim() : "";
    const organizationId = body.organizationId && typeof body.organizationId === "string" 
      ? body.organizationId.trim() 
      : null;

    if (!projectName) {
      return NextResponse.json(
        { status: "error", message: "Project name is required." },
        { status: 400 }
      );
    }

    // 1. Create project in projects table
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: projectName,
        type: "discussion",
        status: "active",
        organization_id: organizationId,
        metadata: {
          rules: [
            "Focus on implementation in 90 days.",
            "Each contribution must contain a clear tactical priority.",
            "Each agent may write a maximum of 3 lines."
          ],
          speaker_order: [
            "manager_l3",
            "hotel_expert_l2",
            "guide_expert_l2",
            "tourismus_expert_l2",
            "user"
          ],
          agent_names: {
            manager_l3: "Manager L3",
            hotel_expert_l2: "Hotel Expert L2",
            guide_expert_l2: "Guide Expert L2",
            tourismus_expert_l2: "Tourismus Expert L2"
          }
        }
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error("Project creation error:", projectError);
      return NextResponse.json(
        { 
          status: "error", 
          message: projectError?.message || "Failed to create project." 
        },
        { status: 500 }
      );
    }

    const projectId = project.id;

    // 2. Create discussion_state for the project
    const { error: stateError } = await supabase
      .from("discussion_state")
      .insert({
        project_id: projectId,
        current_turn_index: 0,
        current_round: 1,
        status: "active"
      });

    if (stateError) {
      console.error("Discussion state creation error:", stateError);
      // Clean up project if state creation fails
      await supabase.from("projects").delete().eq("id", projectId);
      return NextResponse.json(
        { 
          status: "error", 
          message: stateError.message || "Failed to create discussion state." 
        },
        { status: 500 }
      );
    }

    // 3. Create discussion participants
    // First, get the agent IDs for the default agents
    const { data: agents, error: agentsError } = await supabase
      .from("agent_templates")
      .select("id, name")
      .in("name", ["Manager L3", "Hotel Expert L2", "Guide Expert L2", "Tourismus Expert L2"]);

    if (agentsError) {
      console.error("Failed to load agents:", agentsError);
    }

    // Create a map of agent names to IDs
    const agentMap = new Map<string, string>();
    if (agents) {
      for (const agent of agents) {
        agentMap.set(agent.name, agent.id);
      }
    }

    // Create participants in order
    const participants = [
      { 
        project_id: projectId, 
        agent_id: agentMap.get("Manager L3") || null, 
        role: "manager", 
        sequence_order: 0 
      },
      { 
        project_id: projectId, 
        agent_id: agentMap.get("Hotel Expert L2") || null, 
        role: "specialist", 
        sequence_order: 1 
      },
      { 
        project_id: projectId, 
        agent_id: agentMap.get("Guide Expert L2") || null, 
        role: "specialist", 
        sequence_order: 2 
      },
      { 
        project_id: projectId, 
        agent_id: agentMap.get("Tourismus Expert L2") || null, 
        role: "specialist", 
        sequence_order: 3 
      },
      { 
        project_id: projectId, 
        agent_id: null, 
        role: "user", 
        sequence_order: 4 
      }
    ];

    const { error: participantsError } = await supabase
      .from("discussion_participants")
      .insert(participants);

    if (participantsError) {
      console.error("Failed to create participants:", participantsError);
      // Continue anyway - participants can be added later if needed
    }

    return NextResponse.json({
      status: "success",
      project: {
        id: projectId,
        name: project.name,
        type: project.type,
        status: project.status,
        created_at: project.created_at
      }
    });

  } catch (error: unknown) {
    console.error("Project initialization error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Failed to initialize project."
      },
      { status: 500 }
    );
  }
}

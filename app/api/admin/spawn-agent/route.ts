/**
 * @MODULE_ID app.api.admin.spawn-agent
 * @STAGE admin
 * @DATA_INPUTS ["l1_insights", "agent_type", "discipline", "organization_id"]
 * @REQUIRED_TOOLS ["core.zasterix-spawner"]
 */
import { NextResponse } from "next/server";
import { spawnAgent } from "@/core/zasterix-spawner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SpawnAgentBody = {
  organizationId?: string | null;
  discipline?: string;
  category?: string | null;
  agentType?: string;
  icon?: string | null;
  l1Insights?: string[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SpawnAgentBody;
    const result = await spawnAgent({
      organizationId: body.organizationId ?? null,
      discipline: body.discipline,
      category: body.category ?? null,
      agentType: body.agentType,
      icon: body.icon ?? null,
      l1Insights: body.l1Insights ?? [],
    });

    return NextResponse.json({
      status: "success",
      agent: result.agent,
      shared_logic: {
        id: result.sharedLogic.id,
        key: result.sharedLogic.logic_key,
      },
      insights_used: result.insightsUsed,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to spawn agent template.",
      },
      { status: 500 },
    );
  }
}

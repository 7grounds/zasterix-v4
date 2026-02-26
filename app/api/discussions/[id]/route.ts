/**
 * @MODULE_ID app.api.discussions.id
 * @STAGE discussion
 * @DATA_INPUTS ["project_id", "message", "user_id", "organization_id"]
 * @REQUIRED_TOOLS ["core.discussion-engine-v2"]
 */
import { NextResponse } from "next/server";
import { advanceDiscussion, getDiscussionState } from "@/core/discussion-engine-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: { id: string };
};

type DiscussionPostBody = {
  message?: string;
  userId?: string;
  organizationId?: string | null;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const projectId = context.params.id;
    const state = await getDiscussionState(projectId);
    return NextResponse.json({
      status: "success",
      project: state.project,
      entries: state.entries,
      counts: state.counts,
      speakerOrder: state.speakerOrder,
      nextSpeaker: state.nextSpeaker,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Diskussionsdaten konnten nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const projectId = context.params.id;
    const body = (await req.json()) as DiscussionPostBody;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const organizationId =
      typeof body.organizationId === "string" && body.organizationId.trim().length > 0
        ? body.organizationId.trim()
        : null;

    if (!message) {
      return NextResponse.json(
        { status: "error", message: "Nachricht fehlt." },
        { status: 400 },
      );
    }

    if (!userId) {
      return NextResponse.json(
        { status: "error", message: "userId fehlt." },
        { status: 400 },
      );
    }

    const state = await advanceDiscussion({
      projectId,
      message,
      userId,
      organizationId,
    });

    return NextResponse.json({
      status: "success",
      project: state.project,
      entries: state.entries,
      counts: state.counts,
      speakerOrder: state.speakerOrder,
      nextSpeaker: state.nextSpeaker,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Diskussionsbeitrag konnte nicht verarbeitet werden.",
      },
      { status: 500 },
    );
  }
}

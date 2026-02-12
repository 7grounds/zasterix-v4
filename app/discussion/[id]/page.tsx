/**
 * @MODULE_ID app.discussion.id.page
 * @STAGE discussion
 * @DATA_INPUTS ["project_id"]
 * @REQUIRED_TOOLS ["app.discussion.id.interface"]
 */
import DiscussionInterface from "./DiscussionInterface";

type PageProps = {
  params: { id: string };
};

export const dynamic = "force-dynamic";

export default function DiscussionPage({ params }: PageProps) {
  return <DiscussionInterface projectId={params.id} />;
}

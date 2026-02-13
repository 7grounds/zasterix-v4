/**
 * @MODULE_ID app.admin.agents
 * @STAGE admin
 * @DATA_INPUTS ["navigation_intent"]
 * @REQUIRED_TOOLS ["next-navigation"]
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminAgentsPage() {
  redirect("/admin/cockpit");
}

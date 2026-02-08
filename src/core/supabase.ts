/**
 * @MODULE_ID core.supabase
 * @STAGE global
 * @DATA_INPUTS ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
 * @REQUIRED_TOOLS ["@supabase/supabase-js"]
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/core/types/database.types";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl = envUrl || "https://placeholder.supabase.co";
const supabaseAnonKey = envAnonKey || "placeholder";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
export const isSupabaseConfigured = Boolean(envUrl && envAnonKey);

type SaveTaskProgressParams = {
  userId: string;
  stageId: string;
  moduleId: string;
  taskId: string;
  completed?: boolean;
};

export const saveTaskProgress = async ({
  userId,
  stageId,
  moduleId,
  taskId,
  completed = true,
}: SaveTaskProgressParams) => {
  return supabase
    .from("user_progress")
    .upsert(
      {
        user_id: userId,
        stage_id: stageId,
        module_id: moduleId,
        task_id: taskId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      {
        onConflict: "user_id,stage_id,module_id,task_id",
      },
    )
    .select()
    .single();
};

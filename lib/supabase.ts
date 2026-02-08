import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/core/types/database.types";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl = envUrl || "https://placeholder.supabase.co";
const supabaseAnonKey = envAnonKey || "placeholder";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

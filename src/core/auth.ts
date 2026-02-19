import { supabase, isSupabaseConfigured } from "./supabase";

export const requestMagicLink = async (email: string) => {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "/",
    },
  });
};

export const getSession = async () => {
  if (!isSupabaseConfigured) {
    return { data: { user: null }, error: new Error("Supabase is not configured.") };
  }
  return supabase.auth.getUser();
};

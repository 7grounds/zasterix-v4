/**
 * @MODULE_ID core.hooks.user-progress
 * @STAGE global
 * @DATA_INPUTS ["user_progress", "auth.user"]
 * @REQUIRED_TOOLS ["supabase"]
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/core/supabase";

type UserProgressSnapshot = {
  currentStage: string | null;
  currentModule: string | null;
  completedTasks: string[];
  lastSync: string | null;
  isLoading: boolean;
  error: string | null;
};

export const useUserProgress = () => {
  const [snapshot, setSnapshot] = useState<UserProgressSnapshot>({
    currentStage: null,
    currentModule: null,
    completedTasks: [],
    lastSync: null,
    isLoading: true,
    error: null,
  });

  const fetchProgress = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSnapshot((prev) => ({
        ...prev,
        isLoading: false,
        error: "Supabase is not configured.",
      }));
      return;
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      setSnapshot({
        currentStage: null,
        currentModule: null,
        completedTasks: [],
        lastSync: new Date().toISOString(),
        isLoading: false,
        error: userError?.message ?? null,
      });
      return;
    }

    const { data: latestEntry, error: latestError } = await supabase
      .from("user_progress")
      .select("stage_id, module_id, completed_tasks, updated_at")
      .eq("user_id", userData.user.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      setSnapshot({
        currentStage: null,
        currentModule: null,
        completedTasks: [],
        lastSync: new Date().toISOString(),
        isLoading: false,
        error: latestError.message,
      });
      return;
    }

    if (!latestEntry) {
      setSnapshot({
        currentStage: null,
        currentModule: null,
        completedTasks: [],
        lastSync: new Date().toISOString(),
        isLoading: false,
        error: null,
      });
      return;
    }

    const completedTasks = Array.from(
      new Set(latestEntry.completed_tasks ?? []),
    );

    setSnapshot({
      currentStage: latestEntry.stage_id,
      currentModule: latestEntry.module_id,
      completedTasks,
      lastSync: latestEntry.updated_at ?? new Date().toISOString(),
      isLoading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    ...snapshot,
    refresh: fetchProgress,
  };
};

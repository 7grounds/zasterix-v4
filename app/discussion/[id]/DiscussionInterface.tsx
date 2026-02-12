/**
 * @MODULE_ID app.discussion.id.interface
 * @STAGE discussion
 * @DATA_INPUTS ["project", "discussion_entries", "user_input", "discussion_counts"]
 * @REQUIRED_TOOLS ["app.api.discussions.id", "supabase-js"]
 */
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type DiscussionEntry = {
  id: string;
  type: "discussion_turn" | "discussion_summary";
  speakerKey: string;
  speakerName: string;
  speakerRole: "user" | "manager" | "expert";
  content: string;
  createdAt: string | null;
  keywords: string[];
};

type DiscussionProject = {
  id: string;
  name: string;
  status: string;
  metadata: unknown;
  current_discussion_step: number;
};

type DiscussionStateResponse = {
  status: "success" | "error";
  message?: string;
  project?: DiscussionProject;
  entries?: DiscussionEntry[];
  counts?: Record<string, number>;
  speakerOrder?: string[];
  nextSpeaker?: string | null;
};

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const formatTime = (value: string | null) => {
  if (!value) {
    return "--:--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }
  return parsed.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toRuleList = (metadata: unknown): string[] => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const record = metadata as Record<string, unknown>;
  if (!Array.isArray(record.rules)) {
    return [];
  }
  return record.rules
    .map((rule) => (typeof rule === "string" ? rule.trim() : ""))
    .filter((rule) => rule.length > 0);
};

export default function DiscussionInterface({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<DiscussionProject | null>(null);
  const [entries, setEntries] = useState<DiscussionEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [nextSpeaker, setNextSpeaker] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return null;
    }
    return createClient(url, anonKey);
  }, []);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/discussions/${projectId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as DiscussionStateResponse;
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message ?? "Diskussion konnte nicht geladen werden.");
      }

      setProject(payload.project ?? null);
      setEntries(payload.entries ?? []);
      setCounts(payload.counts ?? {});
      setNextSpeaker(payload.nextSpeaker ?? null);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Diskussion konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;
    const resolveUserContext = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;

      const nextUserId = data.user?.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setOrganizationId(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", nextUserId)
        .maybeSingle();
      if (!isMounted) return;
      setOrganizationId(profile?.organization_id ?? null);
    };

    void resolveUserContext();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries]);

  const rules = useMemo(() => toRuleList(project?.metadata), [project?.metadata]);
  const userTurns = counts.user ?? 0;
  const userCanSpeak = userTurns < 2 && project?.status !== "completed";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || submitting || !project || !userId || !userCanSpeak) {
      return;
    }

    const optimisticEntry: DiscussionEntry = {
      id: createId(),
      type: "discussion_turn",
      speakerKey: "user",
      speakerName: "User",
      speakerRole: "user",
      content: message,
      createdAt: new Date().toISOString(),
      keywords: [],
    };

    setEntries((previous) => [...previous, optimisticEntry]);
    setInput("");
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/discussions/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          userId,
          organizationId,
        }),
      });

      const payload = (await response.json()) as DiscussionStateResponse;
      if (!response.ok || payload.status !== "success") {
        throw new Error(payload.message ?? "Beitrag konnte nicht verarbeitet werden.");
      }

      setProject(payload.project ?? null);
      setEntries(payload.entries ?? []);
      setCounts(payload.counts ?? {});
      setNextSpeaker(payload.nextSpeaker ?? null);
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Beitrag konnte nicht verarbeitet werden.",
      );
      await fetchState();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] rounded-3xl border border-slate-800/70 bg-slate-950 p-6 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)] md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
            Discussion Round
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            {project?.name ?? "Diskussionsrunde"}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
          <span>Status:</span>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
              project?.status === "completed"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {project?.status ?? "loading"}
          </span>
        </div>
      </div>

      {rules.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Rules</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {rules.map((rule) => (
              <li key={rule}>- {rule}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
        <span>User Turns: {userTurns}/2</span>
        <span>Next: {nextSpeaker ?? "--"}</span>
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
        {loading ? (
          <p className="text-sm text-slate-400">Diskussion wird geladen...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-400">
            Schreibe eine erste Nachricht, damit Manager L3 die Runde eroeffnet.
          </p>
        ) : (
          entries.map((entry) => (
            <article
              key={entry.id}
              className={`rounded-xl border px-3 py-2 text-sm ${
                entry.speakerRole === "user"
                  ? "border-[#056162]/60 bg-[#056162]/20"
                  : entry.speakerRole === "manager"
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-900/80"
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
                <span>{entry.speakerName}</span>
                <span>{formatTime(entry.createdAt)}</span>
              </div>
              <p className="whitespace-pre-line text-slate-100">{entry.content}</p>
              {entry.keywords.length > 0 ? (
                <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                  Keywords: {entry.keywords.join(", ")}
                </p>
              ) : null}
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>

      {error ? (
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-rose-400">{error}</p>
      ) : null}

      <form className="mt-4 flex gap-3" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            userCanSpeak
              ? "Schreibe deinen Beitrag..."
              : "Du hast das 2-Beitraege-Limit erreicht."
          }
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500/60"
          disabled={submitting || !userCanSpeak || !userId}
        />
        <button
          type="submit"
          disabled={submitting || !input.trim() || !userCanSpeak || !userId}
          className="rounded-xl bg-emerald-500 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

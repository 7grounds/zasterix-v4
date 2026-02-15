/**
 * @MODULE_ID app.meetings.index
 * @STAGE meetings
 * @DATA_INPUTS ["projects", "discussion_logs"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type MeetingProject = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: {
    summary?: string;
    topic?: string;
    agents?: string[];
    completed_at?: string;
  };
};

export default async function MeetingsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return (
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 p-8 text-slate-200">
        <h2 className="text-xl font-semibold">Completed Meetings</h2>
        <p className="mt-3 text-sm text-slate-400">Supabase ist nicht konfiguriert.</p>
      </section>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Fetch completed discussion projects
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, created_at, updated_at, metadata")
    .eq("type", "discussion")
    .order("updated_at", { ascending: false })
    .limit(20);

  const meetings: MeetingProject[] = error ? [] : (data as MeetingProject[] | null) ?? [];

  // Separate completed and active meetings
  const completedMeetings = meetings.filter(m => m.status === "completed");
  const activeMeetings = meetings.filter(m => m.status === "active");

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 p-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
              Multi-Agent Discussions
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Completed Meetings</h1>
          </div>
          <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
            {completedMeetings.length} completed
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {completedMeetings.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Keine abgeschlossenen Meetings gefunden.</p>
              <Link
                href="/manager-alpha"
                className="mt-4 inline-block rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-950 transition hover:bg-emerald-400"
              >
                Start New Meeting
              </Link>
            </div>
          ) : (
            completedMeetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/meetings/${meeting.id}`}
                className="block rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 transition hover:border-emerald-400/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                        ✓ Completed
                      </span>
                      <span>{formatDate(meeting.metadata?.completed_at || meeting.updated_at)}</span>
                    </div>
                    <p className="mt-2 text-base font-semibold text-slate-100">{meeting.name}</p>
                    {meeting.metadata?.topic && (
                      <p className="mt-1 text-sm text-slate-400">
                        Topic: {meeting.metadata.topic}
                      </p>
                    )}
                    {meeting.metadata?.agents && meeting.metadata.agents.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Participants: {meeting.metadata.agents.join(", ")}
                      </p>
                    )}
                    {meeting.metadata?.summary && (
                      <div className="mt-3 rounded-xl border border-emerald-800/40 bg-emerald-900/20 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                          Summary
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                          {meeting.metadata.summary}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    <p className="text-[10px]">{meeting.id.slice(0, 8)}...</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {activeMeetings.length > 0 && (
        <section className="rounded-3xl border border-slate-800/70 bg-slate-950 p-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Meetings</h2>
            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
              {activeMeetings.length} active
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {activeMeetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/manager-alpha?projectId=${meeting.id}`}
                className="block rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-4 transition hover:border-yellow-400/60"
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></span>
                  <span>In Progress</span>
                  <span>{formatDate(meeting.created_at)}</span>
                </div>
                <p className="mt-2 text-base font-semibold text-slate-100">{meeting.name}</p>
                {meeting.metadata?.topic && (
                  <p className="mt-1 text-sm text-slate-400">
                    Topic: {meeting.metadata.topic}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

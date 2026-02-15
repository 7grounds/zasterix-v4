/**
 * @MODULE_ID app.meetings.id.page
 * @STAGE meetings
 * @DATA_INPUTS ["project_id", "discussion_logs"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

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
    rounds?: number;
    rules?: string[];
    completed_at?: string;
  };
};

type DiscussionLog = {
  id: string;
  speaker_name: string;
  content: string;
  created_at: string;
};

export default async function MeetingDetailPage({ params }: PageProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return (
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 p-8 text-slate-200">
        <h2 className="text-xl font-semibold">Meeting Details</h2>
        <p className="mt-3 text-sm text-slate-400">Supabase ist nicht konfiguriert.</p>
      </section>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch project details
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, status, created_at, updated_at, metadata")
    .eq("id", params.id)
    .eq("type", "discussion")
    .maybeSingle();

  if (projectError || !project) {
    notFound();
  }

  const meeting = project as MeetingProject;

  // Fetch discussion logs
  const { data: logs, error: logsError } = await supabase
    .from("discussion_logs")
    .select("id, speaker_name, content, created_at")
    .eq("project_id", params.id)
    .order("created_at", { ascending: true });

  const discussionLogs: DiscussionLog[] = logsError ? [] : (logs as DiscussionLog[] | null) ?? [];

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

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString("de-CH", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  // Identify summary message
  const summaryLog = discussionLogs.find(log => 
    log.speaker_name.includes("Summary") || 
    log.speaker_name.includes("Zusammenfassung")
  );

  // Get non-summary messages
  const discussionMessages = discussionLogs.filter(log => log.id !== summaryLog?.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/meetings"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 transition hover:border-emerald-500/60"
        >
          ← Back to Meetings
        </Link>
      </div>

      {/* Meeting Info Card */}
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 p-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                Meeting Details
              </p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                meeting.status === "completed"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-yellow-500/20 text-yellow-300"
              }`}>
                {meeting.status === "completed" ? "✓ Completed" : "In Progress"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold">{meeting.name}</h1>
            
            {meeting.metadata?.topic && (
              <p className="mt-2 text-sm text-slate-400">
                <span className="text-slate-500">Topic:</span> {meeting.metadata.topic}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
              <div>
                <span className="text-slate-500">Created:</span> {formatDate(meeting.created_at)}
              </div>
              {meeting.metadata?.completed_at && (
                <div>
                  <span className="text-slate-500">Completed:</span> {formatDate(meeting.metadata.completed_at)}
                </div>
              )}
              <div>
                <span className="text-slate-500">Messages:</span> {discussionLogs.length}
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Project ID</p>
            <p className="mt-1 font-mono">{meeting.id}</p>
          </div>
        </div>

        {/* Meeting Metadata */}
        {(meeting.metadata?.agents || meeting.metadata?.rules) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {meeting.metadata.agents && meeting.metadata.agents.length > 0 && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Participants</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {meeting.metadata.agents.map((agent, idx) => (
                    <span
                      key={idx}
                      className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300"
                    >
                      {agent}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {meeting.metadata.rules && meeting.metadata.rules.length > 0 && (
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Rules</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {meeting.metadata.rules.map((rule, idx) => (
                    <li key={idx}>• {rule}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Summary Section - Highlighted */}
      {(meeting.metadata?.summary || summaryLog) && (
        <section className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 to-slate-950 p-8 shadow-[0_20px_55px_rgba(16,185,129,0.15)]">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-emerald-500/20 p-2">
              <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-emerald-100">Meeting Summary</h2>
          </div>
          
          <div className="mt-4 rounded-2xl border border-emerald-800/60 bg-emerald-950/30 px-6 py-4">
            <p className="whitespace-pre-line text-base leading-relaxed text-slate-200">
              {meeting.metadata?.summary || summaryLog?.content}
            </p>
          </div>

          {summaryLog && (
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400/80">
              <span>Generated by {summaryLog.speaker_name}</span>
              <span>•</span>
              <span>{formatTime(summaryLog.created_at)}</span>
            </div>
          )}
        </section>
      )}

      {/* Discussion Transcript */}
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 p-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
        <h2 className="text-xl font-semibold">Full Transcript</h2>
        <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
          {discussionMessages.length} messages
        </p>

        <div className="mt-6 space-y-3">
          {discussionMessages.length === 0 ? (
            <p className="text-sm text-slate-400">No discussion messages found.</p>
          ) : (
            discussionMessages.map((log) => {
              const isUser = log.speaker_name.toLowerCase() === "user";
              const isManager = log.speaker_name.includes("Manager") || log.speaker_name.includes("L3");
              
              return (
                <article
                  key={log.id}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    isUser
                      ? "border-[#056162]/60 bg-[#056162]/20"
                      : isManager
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-900/80"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    <span className="font-semibold text-slate-300">{log.speaker_name}</span>
                    <span>{formatTime(log.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-line text-slate-100">{log.content}</p>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href="/manager-alpha"
          className="rounded-xl bg-emerald-500 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-950 transition hover:bg-emerald-400"
        >
          Start New Meeting
        </Link>
        <Link
          href="/meetings"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 transition hover:border-emerald-500/60"
        >
          View All Meetings
        </Link>
      </div>
    </div>
  );
}

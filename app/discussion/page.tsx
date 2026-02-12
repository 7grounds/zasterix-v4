/**
 * @MODULE_ID app.discussion.index
 * @STAGE discussion
 * @DATA_INPUTS ["projects"]
 * @REQUIRED_TOOLS ["supabase-js"]
 */
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type DiscussionProject = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
};

export default async function DiscussionIndexPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <section className="rounded-3xl border border-slate-800/70 bg-slate-950 p-8 text-slate-200">
        <h2 className="text-xl font-semibold">Discussion Projects</h2>
        <p className="mt-3 text-sm text-slate-400">Supabase ist nicht konfiguriert.</p>
      </section>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, updated_at")
    .eq("type", "discussion")
    .order("updated_at", { ascending: false })
    .limit(20);

  const projects: DiscussionProject[] = error ? [] : (data as DiscussionProject[] | null) ?? [];

  return (
    <section className="rounded-3xl border border-slate-800/70 bg-slate-950 p-8 text-slate-100 shadow-[0_20px_55px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Discussion Projects</h2>
        <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
          {projects.length} active
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {projects.length === 0 ? (
          <p className="text-sm text-slate-400">Keine Diskussionen gefunden.</p>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/discussion/${project.id}`}
              className="block rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3 transition hover:border-emerald-400/60"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                <span>{project.status}</span>
                <span>{new Date(project.updated_at).toLocaleString("de-CH")}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-100">{project.name}</p>
              <p className="mt-1 text-[11px] text-slate-400">{project.id}</p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

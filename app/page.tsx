/**
 * @MODULE_ID app.home.landing
 * @STAGE global
 * @DATA_INPUTS ["none"]
 * @REQUIRED_TOOLS []
 */
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-3xl border border-slate-800/70 bg-slate-950 px-8 py-10 text-slate-100 shadow-[0_25px_60px_rgba(15,23,42,0.4)]">
      <div className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
          Zasterix
        </p>
        <h1 className="text-3xl font-semibold">Zasterix Vault</h1>
        <p className="text-sm text-slate-400">
          Private access to the executive cockpit.
        </p>
      </div>

      <a
        className="mx-auto inline-flex items-center justify-center rounded-full bg-amber-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-900 shadow-[0_12px_30px_rgba(251,191,36,0.35)] transition hover:bg-amber-200"
        href="/zasterix-vault"
      >
        Vault öffnen
      </a>
    </div>
  );
}

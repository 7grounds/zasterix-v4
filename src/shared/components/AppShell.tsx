/**
 * @MODULE_ID shared.components.app-shell
 * @STAGE global
 * @DATA_INPUTS ["children"]
 * @REQUIRED_TOOLS ["TaskProgressBar"]
 */
import type { ReactNode } from "react";
import { TaskProgressBar } from "@/shared/components/TaskProgressBar";

type AppShellProps = {
  children: ReactNode;
};

export const AppShell = ({ children }: AppShellProps) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-12 pt-10 lg:px-10">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Zasterix
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                AI-Driven Wealth Engineering
              </h1>
            </div>
            <div className="text-right text-xs uppercase tracking-[0.3em] text-slate-400">
              Yuh Edition
            </div>
          </div>
          <TaskProgressBar />
        </header>

        <main className="space-y-10">{children}</main>
      </div>
    </div>
  );
};

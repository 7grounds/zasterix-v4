/**
 * @MODULE_ID stage-1.asset-coach.task-renderer
 * @STAGE stage-1
 * @DATA_INPUTS ["tasks", "assetInput", "progressState"]
 * @REQUIRED_TOOLS ["useProgressStore", "YuhConnector", "supabase", "updateTaskProgress"]
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { TaskDefinition } from "@/shared/tools/taskSchema";
import { useProgressStore } from "@/core/store";
import { useTenant } from "@/core/tenant-context";
import { supabase } from "@/core/supabase";
import { updateTaskProgress } from "@/core/progress";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { YuhConnector } from "@/shared/tools/YuhConnector";
import { AgentConsole } from "@/shared/components/AgentConsole";
import { EXECUTIVE_APPROVAL_TOKEN } from "@/core/governance";
import {
  generateAssetCoachPrompt,
  generateSwissWealthAnalysis,
  runAssetCoachAgent,
  type AgentStatusStep,
} from "./ai-logic";
import { lookupAsset, isLikelyIsin, type AssetProfile } from "@/shared/tools/IsinAnalyzer";

type TaskRendererProps = {
  moduleId: string;
  stageId: string;
  tasks: TaskDefinition[];
};

const INPUT_TASK_ID = "identify-asset";

const renderParagraphs = (content: string) => {
  return content.split("\n\n").map((paragraph, index) => (
    <p key={`analysis-${index}`} className="leading-relaxed text-slate-200">
      {paragraph}
    </p>
  ));
};

export const TaskRenderer = ({ moduleId, stageId, tasks }: TaskRendererProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedTasks, setCompletedTasksLocal] = useState<
    Record<string, boolean>
  >({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [analysisSeed, setAnalysisSeed] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [assetLookupState, setAssetLookupState] = useState<{
    status: "idle" | "loading" | "found" | "not-found";
    asset: AssetProfile | null;
  }>({ status: "idle", asset: null });
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [hardContext, setHardContext] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatusStep[]>([]);
  const [agentOutput, setAgentOutput] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [statusIndicator, setStatusIndicator] = useState<string | null>(null);

  const { setTotalTasks, setCompletedTasks } = useProgressStore();
  const { organization } = useTenant();
  const completedCount = useMemo(() => {
    return Object.values(completedTasks).filter(Boolean).length;
  }, [completedTasks]);
  const assetInput = inputValues[INPUT_TASK_ID] ?? "";
  const currentTask = tasks[currentIndex];
  const isLastStep = currentIndex === tasks.length - 1;

  useEffect(() => {
    setTotalTasks(tasks.length);
  }, [setTotalTasks, tasks.length]);

  useEffect(() => {
    setCompletedTasks(completedCount);
  }, [completedCount, setCompletedTasks]);

  useEffect(() => {
    let isActive = true;
    const input = assetInput.trim();

    if (!input) {
      setAssetLookupState({ status: "idle", asset: null });
      return () => {
        isActive = false;
      };
    }

    setAssetLookupState({ status: "loading", asset: null });

    lookupAsset(input).then((asset) => {
      if (!isActive) return;
      setAssetLookupState({
        status: asset ? "found" : "not-found",
        asset: asset ?? null,
      });
    });

    return () => {
      isActive = false;
    };
  }, [assetInput]);

  useEffect(() => {
    let isActive = true;

    const buildPrompt = async () => {
      if (!assetInput.trim()) {
        setAiPrompt(null);
        setHardContext(null);
        setAgentOutput(null);
        setAgentStatus([]);
        return;
      }
      const result = await generateAssetCoachPrompt(
        assetInput,
        tasks.find((task) => task.type === "ai-coach")?.prompt,
        assetLookupState.asset,
      );
      if (!isActive) return;
      setAiPrompt(result.prompt);
      setHardContext(result.hardContext);
    };

    buildPrompt();

    return () => {
      isActive = false;
    };
  }, [assetInput, assetLookupState.asset, tasks]);

  useEffect(() => {
    let isActive = true;

    const runAgent = async () => {
      if (!assetInput.trim() || currentTask?.type !== "ai-coach") {
        setAgentOutput(null);
        setAgentStatus([]);
        setStatusIndicator(null);
        return;
      }
      setAgentRunning(true);
      const result = await runAssetCoachAgent(
        assetInput,
        1000,
        tasks.find((task) => task.type === "ai-coach")?.prompt,
        (_step, steps) => {
          if (!isActive) return;
          setAgentStatus(steps);
          const latest = steps[steps.length - 1]?.label ?? "";
          if (latest.includes("IsinAnalyzer")) {
            setStatusIndicator("Agent is checking ISIN...");
          } else if (latest.includes("FeeCalculator")) {
            setStatusIndicator("Agent is calculating fees...");
          } else if (latest.includes("YuhLinker")) {
            setStatusIndicator("Agent is preparing Yuh link...");
          } else if (latest.includes("FINAL")) {
            setStatusIndicator("Agent is preparing final response...");
          } else {
            setStatusIndicator("Agent is analyzing...");
          }
        },
        {
          userId,
          organizationId: organization?.id ?? null,
        },
        EXECUTIVE_APPROVAL_TOKEN,
      );
      if (!isActive) return;
      setAgentStatus(result.statusSteps);
      setHardContext(result.hardContext);
      setAgentOutput(result.finalResponse);
      setAgentRunning(false);
    };

    runAgent();

    return () => {
      isActive = false;
    };
  }, [assetInput, tasks, currentTask?.type, userId, organization?.id]);
  useEffect(() => {
    let isMounted = true;

    const resolveUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (error || !data.user) {
        setUserId(null);
        return;
      }
      setUserId(data.user.id);
    };

    resolveUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const analysis = useMemo(() => {
    const base = generateSwissWealthAnalysis(assetInput);
    return analysisSeed ? `${base}\n\nRevision: ${analysisSeed}` : base;
  }, [assetInput, analysisSeed]);

  const handleNext = () => {
    if (!currentTask) return;
    const updatedCompleted = {
      ...completedTasks,
      [currentTask.id]: true,
    };
    setCompletedTasksLocal(updatedCompleted);

    if (userId) {
      updateTaskProgress(userId, stageId, moduleId, currentTask.id);
    }

    if (!isLastStep) {
      setCurrentIndex((prev) => Math.min(tasks.length - 1, prev + 1));
    }
  };

  const handleBack = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const canAdvance =
    currentTask?.type !== "input" || assetInput.trim().length > 0;

  if (!currentTask) {
    return null;
  }

  return (
    <section className="space-y-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          {stageId} / {moduleId}
        </p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">
            AI-Asset-Coach
          </h1>
          <p className="max-w-2xl text-base text-slate-600">
            Deploy AI to stress-test a single asset before it enters the Yuh
            wealth engine.
          </p>
        </div>
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
          <span>
            Step {currentIndex + 1} of {tasks.length}
          </span>
          <span>
            {Object.values(completedTasks).filter(Boolean).length} completed
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200/80">
          <div
            className="h-1.5 rounded-full bg-emerald-500 transition-all"
            style={{
              width: `${Math.round(((currentIndex + 1) / tasks.length) * 100)}%`,
            }}
          />
        </div>
      </header>

      <Card>
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              {currentTask.type.replace("-", " ")}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {currentTask.title}
            </h2>
            {currentTask.description ? (
              <p className="mt-2 text-sm text-slate-500">
                {currentTask.description}
              </p>
            ) : null}
          </div>

          {currentTask.type === "input" ? (
            <div className="space-y-2">
              {currentTask.inputLabel ? (
                <label className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  {currentTask.inputLabel}
                </label>
              ) : null}
              <input
                className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:outline-none"
                onChange={(event) =>
                  setInputValues((prev) => ({
                    ...prev,
                    [currentTask.id]: event.target.value,
                  }))
                }
                placeholder={currentTask.placeholder ?? "Type here"}
                type="text"
                value={inputValues[currentTask.id] ?? ""}
              />
              {currentTask.id === INPUT_TASK_ID ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="uppercase tracking-[0.22em] text-slate-400">
                    Validate
                  </span>
                  {assetLookupState.status === "loading" ? (
                    <span className="text-slate-400">Checking ISIN...</span>
                  ) : null}
                  {assetLookupState.status === "found" &&
                  assetLookupState.asset ? (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-emerald-400">
                      Found: {assetLookupState.asset.name}
                    </span>
                  ) : null}
                  {assetLookupState.status === "not-found" &&
                  isLikelyIsin(assetInput) ? (
                    <span className="text-rose-400">No match found</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {currentTask.type === "ai-coach" ? (
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-950 px-5 py-5 text-slate-100 shadow-inner">
              <p className="text-xs uppercase tracking-[0.26em] text-emerald-400">
                AI-Generated Assessment
              </p>
              {agentRunning ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs uppercase tracking-[0.2em] text-emerald-200">
                  {statusIndicator ?? "Agent is calling tools..."}
                </div>
              ) : null}
              <AgentConsole entries={agentStatus.map((step) => step.label)} />
              {hardContext ? (
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {hardContext}
                </p>
              ) : null}
              <div className="space-y-4 text-sm">
                {renderParagraphs(agentOutput ?? analysis)}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => setAnalysisSeed((prev) => prev + 1)}
                >
                  Regenerate Insight
                </Button>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Prompted by Swiss wealth standards
                </span>
              </div>
              {aiPrompt ?? currentTask.prompt ? (
                <p className="text-xs leading-relaxed text-slate-400">
                  Prompt: {aiPrompt ?? currentTask.prompt}
                </p>
              ) : null}
            </div>
          ) : null}

          {currentTask.type === "tool-action" ? (
            <div className="flex flex-wrap items-center gap-4">
              {currentTask.toolId === "yuh-connector" ? (
                <YuhConnector
                  action={currentTask.action}
                  amount={currentTask.amount}
                  currency={currentTask.currency}
                  label={currentTask.actionLabel}
                />
              ) : null}
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Tool: {currentTask.toolId}
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={currentIndex === 0}
        >
          Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {currentTask.id}
          </span>
          <Button
            variant="action"
            size="sm"
            onClick={handleNext}
            disabled={!canAdvance}
          >
            {isLastStep ? "Complete Module" : "Continue"}
          </Button>
        </div>
      </div>
    </section>
  );
};

/**
 * @MODULE_ID app.admin.debug.[meetingId]
 * @STAGE admin
 * @DATA_INPUTS ["meetingId", "meetings", "hierarchy", "discussion_logs", "agent_templates"]
 * @REQUIRED_TOOLS ["supabase-js", "react", "next"]
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/core/supabase";
import type { Database } from "@/core/types/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type DiscussionLog = Database["public"]["Tables"]["discussion_logs"]["Row"];
type Hierarchy = Database["public"]["Tables"]["hierarchy"]["Row"];
type AgentTemplate = Database["public"]["Tables"]["agent_templates"]["Row"];

interface MeetingState {
  project: Project | null;
  hierarchy: Hierarchy[];
  logs: DiscussionLog[];
  currentAgent: AgentTemplate | null;
  error: string | null;
  isLoading: boolean;
}

export default function MeetingTracePage() {
  const params = useParams();
  const meetingId = params?.meetingId as string;
  
  const [state, setState] = useState<MeetingState>({
    project: null,
    hierarchy: [],
    logs: [],
    currentAgent: null,
    error: null,
    isLoading: true,
  });

  const fetchMeetingData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch project/meeting data
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", meetingId)
        .eq("type", "discussion")
        .single();

      if (projectError) throw new Error(`Project error: ${projectError.message}`);
      
      const project = projectData as Project;

      // Fetch hierarchy
      const { data: hierarchyData, error: hierarchyError } = await supabase
        .from("hierarchy")
        .select("*")
        .eq("project_id", meetingId)
        .eq("is_active", true)
        .order("turn_order", { ascending: true });

      if (hierarchyError) throw new Error(`Hierarchy error: ${hierarchyError.message}`);

      // Fetch last 10 discussion logs
      const { data: logsData, error: logsError } = await supabase
        .from("discussion_logs")
        .select("*")
        .eq("project_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (logsError) throw new Error(`Logs error: ${logsError.message}`);

      // Fetch current agent if set
      let currentAgent: AgentTemplate | null = null;
      if (project && project.current_turn_agent_id) {
        const { data: agentData, error: agentError } = await supabase
          .from("agent_templates")
          .select("*")
          .eq("id", project.current_turn_agent_id)
          .single();

        if (!agentError && agentData) {
          currentAgent = agentData as AgentTemplate;
        }
      }

      setState({
        project,
        hierarchy: (hierarchyData as Hierarchy[]) || [],
        logs: ((logsData as DiscussionLog[]) || []).reverse(), // Show oldest first
        currentAgent,
        error: null,
        isLoading: false,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : "Unknown error",
        isLoading: false,
      }));
    }
  };

  useEffect(() => {
    if (meetingId) {
      fetchMeetingData();
    }
  }, [meetingId]);

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="text-emerald-400 text-xl mb-2">Loading Meeting Data...</div>
          <div className="text-slate-500 text-sm">Fetching from Supabase</div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-950 border border-red-800 rounded-lg p-6">
            <h2 className="text-red-400 font-bold text-xl mb-2">Error Loading Meeting</h2>
            <p className="text-red-300">{state.error}</p>
            <button
              onClick={fetchMeetingData}
              className="mt-4 px-4 py-2 bg-red-800 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { project, hierarchy, logs, currentAgent } = state;

  // Parse metadata
  const metadata = project?.metadata as Record<string, unknown> || {};
  const rules = (metadata.rules as string[]) || [];
  const speakerOrder = (metadata.speaker_order as string[]) || [];

  // Check if current turn matches last message
  const lastLog = logs[logs.length - 1];
  const turnMismatch = lastLog && project?.current_turn_agent_id !== lastLog.agent_id;

  // Parse AI model config
  const aiConfig = currentAgent?.ai_model_config as Record<string, unknown> || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-emerald-400">
                Origo Meeting Trace
              </h1>
              <p className="text-slate-400 mt-1 text-sm uppercase tracking-wider">
                Meeting ID: {meetingId}
              </p>
            </div>
            <button
              onClick={fetchMeetingData}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold rounded-lg transition-colors"
            >
              🔄 Refresh State
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Meeting State Table */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-emerald-400 mb-4 uppercase tracking-wider">
            📊 Meeting State
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Name</div>
              <div className="text-lg font-semibold">{project?.name}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Status</div>
              <div className={`text-lg font-semibold ${project?.status === 'active' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {project?.status}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Current Turn</div>
              <div className="text-lg font-semibold text-orange-400">
                {project?.current_discussion_step}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase mb-1">Current Agent</div>
              <div className="text-lg font-semibold">
                {currentAgent?.name || <span className="text-slate-600">None</span>}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500 uppercase mb-1">Last Updated</div>
              <div className="text-sm">
                {project?.updated_at ? new Date(project.updated_at).toLocaleString() : "N/A"}
              </div>
            </div>
          </div>

          {turnMismatch && (
            <div className="mt-4 p-4 bg-yellow-950 border border-yellow-800 rounded">
              <div className="text-yellow-400 font-bold">⚠️ Turn Mismatch Detected</div>
              <div className="text-yellow-300 text-sm mt-1">
                Current turn agent ID does not match the last message sender!
              </div>
            </div>
          )}
        </section>

        {/* Active Hierarchy */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-emerald-400 mb-4 uppercase tracking-wider">
            🔄 Active Hierarchy
          </h2>
          {hierarchy.length === 0 ? (
            <div className="text-slate-500 italic">No hierarchy defined for this meeting</div>
          ) : (
            <div className="space-y-3">
              {hierarchy.map((h, idx) => (
                <div
                  key={h.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    h.agent_id === project?.current_turn_agent_id
                      ? 'bg-emerald-950 border-emerald-700 shadow-lg'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    h.agent_id === project?.current_turn_agent_id
                      ? 'bg-emerald-600 text-slate-900'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {h.turn_order}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{h.agent_name}</div>
                    <div className="text-xs text-slate-500">Agent ID: {h.agent_id?.slice(0, 8)}...</div>
                  </div>
                  {idx < hierarchy.length - 1 && (
                    <div className="text-2xl text-slate-600">→</div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {speakerOrder.length > 0 && (
            <div className="mt-4 p-4 bg-slate-800 rounded">
              <div className="text-xs text-slate-500 uppercase mb-2">Metadata Speaker Order</div>
              <div className="text-sm font-mono text-slate-300">
                {speakerOrder.join(' → ')}
              </div>
            </div>
          )}
        </section>

        {/* Current Agent Brain */}
        {currentAgent && (
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-emerald-400 mb-4 uppercase tracking-wider">
              🧠 The AI&apos;s Brain (Current Agent)
            </h2>
            
            {/* Agent Info */}
            <div className="mb-4 p-4 bg-slate-800 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-xl font-bold text-orange-400">{currentAgent.name}</h3>
                  <p className="text-sm text-slate-400">{currentAgent.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase">Level</div>
                  <div className="text-2xl font-bold text-emerald-400">{currentAgent.level || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Groq Configuration */}
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Groq Configuration</h3>
              <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm">
                <pre className="text-emerald-300 whitespace-pre-wrap">
                  {JSON.stringify(aiConfig, null, 2)}
                </pre>
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">System Prompt (Raw Injection)</h3>
              <div className="bg-slate-950 border border-slate-700 rounded-lg p-6">
                <pre className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                  {currentAgent.system_prompt}
                </pre>
              </div>
            </div>
          </section>
        )}

        {/* Discussion Rules */}
        {rules.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-emerald-400 mb-4 uppercase tracking-wider">
              📋 Discussion Rules
            </h2>
            <ul className="space-y-2">
              {rules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span className="text-slate-300">{rule}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Last 5 Messages */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-emerald-400 mb-4 uppercase tracking-wider">
            💬 Last {Math.min(logs.length, 5)} Messages (Context for AI)
          </h2>
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">No messages yet</div>
          ) : (
            <div className="space-y-4">
              {logs.slice(-5).map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-orange-400">{log.speaker_name}</span>
                      <span className="text-xs text-slate-500">Turn #{log.turn_number}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-slate-300 whitespace-pre-wrap">
                    {log.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Raw JSON Data */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-emerald-400 mb-4 uppercase tracking-wider">
            🔍 Raw Meeting JSON
          </h2>
          <details className="cursor-pointer">
            <summary className="text-sm text-slate-400 hover:text-slate-300">
              Click to expand raw data
            </summary>
            <div className="mt-4 bg-slate-950 rounded-lg p-4 font-mono text-xs overflow-x-auto">
              <pre className="text-emerald-300">
                {JSON.stringify({ project, hierarchy, logs: logs.slice(-5) }, null, 2)}
              </pre>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}

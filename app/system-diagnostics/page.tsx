'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Project {
  id: string;
  name: string;
  status: string;
  created_at: string;
  metadata: any;
}

interface DiscussionLog {
  id: string;
  project_id: string;
  speaker_name: string;
  content: string;
  round_number: number | null;
  turn_index: number | null;
  metadata: any;
  created_at: string;
}

interface Participant {
  id: string;
  project_id: string;
  agent_id: string | null;
  role: string;
  sequence_order: number;
  status: string;
  agent_templates?: { name: string }[];
}

interface DiagnosticData {
  projects: Project[];
  discussionLogs: DiscussionLog[];
  participants: Participant[];
  lastRefresh: string;
}

export default function SystemDiagnosticsPage() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch active projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('type', 'discussion')
        .order('created_at', { ascending: false })
        .limit(10);

      if (projectsError) throw projectsError;

      // Fetch discussion logs
      const { data: logs, error: logsError } = await supabase
        .from('discussion_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      // Fetch participants with agent names
      const { data: participants, error: participantsError } = await supabase
        .from('discussion_participants')
        .select(`
          *,
          agent_templates (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (participantsError) throw participantsError;

      setData({
        projects: projects || [],
        discussionLogs: logs || [],
        participants: participants || [],
        lastRefresh: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchDiagnostics, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getProjectStatus = (projectId: string) => {
    const projectLogs = data?.discussionLogs.filter(log => log.project_id === projectId) || [];
    const projectParticipants = data?.participants.filter(p => p.project_id === projectId) || [];
    
    const hasLogs = projectLogs.length > 0;
    const hasParticipants = projectParticipants.length > 0;
    const lastLog = projectLogs[0];
    const lastRound = lastLog?.round_number ?? lastLog?.turn_index ?? 0;
    
    let status = 'inactive';
    let message = 'No activity';
    
    if (!hasParticipants) {
      status = 'error';
      message = '❌ No participants found';
    } else if (!hasLogs) {
      status = 'waiting';
      message = '⏳ Waiting for first message';
    } else if (lastLog && (Date.now() - new Date(lastLog.created_at).getTime() < 60000)) {
      status = 'active';
      message = '✅ Active (last message < 1 min ago)';
    } else {
      status = 'stalled';
      message = '⚠️ Stalled (no recent activity)';
    }
    
    return { status, message, lastRound, logCount: projectLogs.length, participantCount: projectParticipants.length };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'waiting': return 'text-yellow-600 bg-yellow-50';
      case 'stalled': return 'text-orange-600 bg-orange-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">System Flow Diagnostics</h1>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading diagnostics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">System Flow Diagnostics</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Diagnostics</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchDiagnostics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">System Flow Diagnostics</h1>
            <p className="text-gray-600 mt-1">Debug where discussion flow stops - table, column, line level</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/main-dashboard"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              ← Back to Dashboard
            </Link>
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded ${
                autoRefresh
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {autoRefresh ? '⏸ Stop Auto-Refresh' : '▶️ Auto-Refresh (5s)'}
            </button>
          </div>
        </div>

        {/* Last Refresh Time */}
        <div className="mb-6 text-sm text-gray-600">
          Last refresh: {data?.lastRefresh}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Total Projects</h3>
            <p className="text-3xl font-bold text-blue-600">{data?.projects.length || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Discussion projects</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Total Messages</h3>
            <p className="text-3xl font-bold text-green-600">{data?.discussionLogs.length || 0}</p>
            <p className="text-sm text-gray-500 mt-1">In discussion_logs</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Total Participants</h3>
            <p className="text-3xl font-bold text-purple-600">{data?.participants.length || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Active agents</p>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">Discussion Projects Status</h2>
            <p className="text-sm text-gray-600 mt-1">Click on a project to see detailed flow analysis</p>
          </div>
          <div className="divide-y divide-gray-200">
            {data?.projects.map((project) => {
              const status = getProjectStatus(project.id);
              const isSelected = selectedProject === project.id;
              
              return (
                <div key={project.id}>
                  <div
                    onClick={() => setSelectedProject(isSelected ? null : project.id)}
                    className="p-6 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{project.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
                            {status.message}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Table:</strong> projects</p>
                          <p><strong>Project ID:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{project.id}</code></p>
                          <p><strong>Column status:</strong> {project.status}</p>
                          <p><strong>Created:</strong> {new Date(project.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Round#</p>
                            <p className="text-2xl font-bold text-blue-600">{status.lastRound}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Messages</p>
                            <p className="text-2xl font-bold text-green-600">{status.logCount}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Agents</p>
                            <p className="text-2xl font-bold text-purple-600">{status.participantCount}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isSelected && (
                    <div className="px-6 pb-6 bg-gray-50">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Participants */}
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="font-semibold mb-3 text-purple-700">
                            👥 Participants (Table: discussion_participants)
                          </h4>
                          {data?.participants
                            .filter(p => p.project_id === project.id)
                            .sort((a, b) => a.sequence_order - b.sequence_order)
                            .map((p) => (
                              <div key={p.id} className="mb-2 p-3 bg-purple-50 rounded text-sm border border-purple-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">
                                    {p.agent_templates?.[0]?.name || `${p.role} (no name)`}
                                  </span>
                                  <span className="text-xs px-2 py-1 bg-purple-100 rounded font-mono">
                                    Seq: {p.sequence_order}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 font-mono space-y-1">
                                  <div>ID: {p.id}</div>
                                  <div>agent_id: {p.agent_id || 'NULL'}</div>
                                  <div>role: {p.role}</div>
                                  <div>status: {p.status}</div>
                                </div>
                              </div>
                            ))}
                          {data?.participants.filter(p => p.project_id === project.id).length === 0 && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded">
                              <p className="text-red-600 text-sm font-semibold">
                                ❌ CRITICAL: No rows in discussion_participants table
                              </p>
                              <p className="text-xs text-red-500 mt-1">
                                Flow cannot start without participants
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Messages */}
                        <div className="bg-white rounded-lg p-4">
                          <h4 className="font-semibold mb-3 text-green-700">
                            💬 Messages (Table: discussion_logs)
                          </h4>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {data?.discussionLogs
                              .filter(log => log.project_id === project.id)
                              .slice(0, 10)
                              .map((log) => (
                                <div key={log.id} className="p-3 bg-green-50 rounded text-sm border border-green-200">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-green-800">{log.speaker_name}</span>
                                    <span className="text-xs px-2 py-1 bg-green-100 rounded font-mono">
                                      R#{log.round_number ?? log.turn_index ?? '?'}
                                    </span>
                                  </div>
                                  <p className="text-gray-700 text-xs mb-2 line-clamp-2">{log.content}</p>
                                  <div className="text-xs text-gray-500 font-mono space-y-1">
                                    <div>ID: {log.id}</div>
                                    <div>round_number: {log.round_number ?? 'NULL'}</div>
                                    <div>turn_index: {log.turn_index ?? 'NULL'}</div>
                                    <div>created_at: {new Date(log.created_at).toLocaleString()}</div>
                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                      <div>metadata: {JSON.stringify(log.metadata)}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            {data?.discussionLogs.filter(log => log.project_id === project.id).length === 0 && (
                              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <p className="text-yellow-700 text-sm font-semibold">
                                  ⚠️ No rows in discussion_logs table
                                </p>
                                <p className="text-xs text-yellow-600 mt-1">
                                  Waiting for first message to be inserted
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Flow Analysis */}
                      <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                        <h4 className="font-semibold mb-3 text-blue-800 text-lg">
                          🔍 Flow Analysis - Where Is It Stopping?
                        </h4>
                        <div className="space-y-2 text-sm">
                          {status.participantCount === 0 && (
                            <div className="p-3 bg-red-100 border border-red-300 rounded">
                              <p className="text-red-800 font-semibold">
                                ❌ BLOCKED AT: discussion_participants table
                              </p>
                              <p className="text-red-700 mt-1">
                                Column: COUNT(*) = 0
                              </p>
                              <p className="text-red-600 mt-1 text-xs">
                                Solution: Run recruit_specialists_for_discussion() SQL function
                              </p>
                            </div>
                          )}
                          {status.participantCount > 0 && status.logCount === 0 && (
                            <div className="p-3 bg-yellow-100 border border-yellow-300 rounded">
                              <p className="text-yellow-800 font-semibold">
                                ⏳ WAITING AT: discussion_logs table
                              </p>
                              <p className="text-yellow-700 mt-1">
                                Column: COUNT(*) = 0 for project_id = {project.id}
                              </p>
                              <p className="text-yellow-600 mt-1 text-xs">
                                Status: Participants exist, waiting for first INSERT into discussion_logs
                              </p>
                            </div>
                          )}
                          {status.participantCount > 0 && status.logCount > 0 && status.status === 'stalled' && (
                            <div className="p-3 bg-orange-100 border border-orange-300 rounded">
                              <p className="text-orange-800 font-semibold">
                                ⚠️ STALLED AT: Edge Function trigger
                              </p>
                              <p className="text-orange-700 mt-1">
                                Last row in discussion_logs: {new Date(data?.discussionLogs.filter(log => log.project_id === project.id)[0]?.created_at || '').toLocaleString()}
                              </p>
                              <p className="text-orange-600 mt-1 text-xs">
                                Issue: Messages exist but Edge Function (turn-controller) is not triggering or webhook is not configured
                              </p>
                            </div>
                          )}
                          {status.status === 'active' && (
                            <div className="p-3 bg-green-100 border border-green-300 rounded">
                              <p className="text-green-800 font-semibold">
                                ✅ ACTIVE: Flow is working
                              </p>
                              <p className="text-green-700 mt-1">
                                Latest round_number: {status.lastRound}
                              </p>
                              <p className="text-green-600 mt-1 text-xs">
                                All systems operational - messages being added to discussion_logs
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {data?.projects.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                <p className="font-semibold">No discussion projects found</p>
                <p className="text-sm mt-1">Check projects table WHERE type = 'discussion'</p>
              </div>
            )}
          </div>
        </div>

        {/* Raw Data Export */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">🔧 Debug Tools & SQL Queries</h2>
          <div className="space-y-4">
            <button
              onClick={() => {
                const debugData = {
                  timestamp: new Date().toISOString(),
                  projects: data?.projects,
                  discussionLogs: data?.discussionLogs,
                  participants: data?.participants,
                };
                const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `system-diagnostics-${Date.now()}.json`;
                a.click();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              📥 Export Full Debug Data (JSON)
            </button>
            <div className="bg-gray-900 p-4 rounded text-xs font-mono overflow-x-auto text-green-400">
              <p className="text-gray-400 mb-3">Copy these SQL queries to run in Supabase SQL Editor:</p>
              <pre className="whitespace-pre-wrap">
{`-- 1. Check column existence (round_number vs turn_index)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'discussion_logs' 
AND column_name IN ('round_number', 'turn_index', 'metadata');

-- 2. Check active projects
SELECT id, name, status, type, created_at 
FROM projects 
WHERE type = 'discussion' 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. Check discussion logs (with both columns)
SELECT 
  project_id, 
  speaker_name, 
  round_number, 
  turn_index, 
  LENGTH(content) as content_length,
  metadata,
  created_at 
FROM discussion_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Check participants count per project
SELECT 
  p.id as project_id,
  p.name as project_name,
  COUNT(dp.id) as participant_count
FROM projects p
LEFT JOIN discussion_participants dp ON p.id = dp.project_id
WHERE p.type = 'discussion'
GROUP BY p.id, p.name
ORDER BY p.created_at DESC;

-- 5. Check for specific project (replace with actual ID)
SELECT 
  'participants' as table_name,
  COUNT(*) as row_count
FROM discussion_participants 
WHERE project_id = 'YOUR-PROJECT-ID-HERE'
UNION ALL
SELECT 
  'discussion_logs',
  COUNT(*)
FROM discussion_logs 
WHERE project_id = 'YOUR-PROJECT-ID-HERE';`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

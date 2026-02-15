'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useMemo } from 'react';

interface Participant {
  id: string;
  agent_id: string | null;
  role: 'manager' | 'leader' | 'specialist' | 'user';
  sequence_order: number;
  agent_name?: string;
  status: string;
}

interface DiscussionLog {
  id: string;
  turn_index: number;
  speaker_name: string;
  content: string;
  created_at: string;
}

interface AgentStatusMonitorProps {
  projectId: string;
}

// Define type for Supabase response with nested agent_templates
interface ParticipantWithAgent {
  id: string;
  agent_id: string | null;
  role: 'manager' | 'leader' | 'specialist' | 'user';
  sequence_order: number;
  status: string;
  agent_templates: {
    name: string;
  } | null;
}

export default function AgentStatusMonitor({ projectId }: AgentStatusMonitorProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [latestTurnIndex, setLatestTurnIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create supabase client once using useMemo to avoid re-creating on each render
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    if (!projectId) return;

    // Fetch initial data
    const fetchInitialData = async () => {
      try {
        // Fetch participants with agent details
        const { data: participantsData, error: participantsError } = await supabase
          .from('discussion_participants')
          .select(`
            id,
            agent_id,
            role,
            sequence_order,
            status,
            agent_templates (
              name
            )
          `)
          .eq('project_id', projectId)
          .eq('status', 'active')
          .order('sequence_order', { ascending: true });

        if (participantsError) throw participantsError;

        // Map participants with agent names - using proper type instead of any
        const mappedParticipants: Participant[] = (participantsData || []).map((p: ParticipantWithAgent) => ({
          id: p.id,
          agent_id: p.agent_id,
          role: p.role,
          sequence_order: p.sequence_order,
          status: p.status,
          agent_name: p.agent_templates?.name || (p.role === 'user' ? 'User (You)' : 'Unknown'),
        }));

        setParticipants(mappedParticipants);

        // Fetch latest turn_index from discussion_logs
        const { data: logsData, error: logsError } = await supabase
          .from('discussion_logs')
          .select('turn_index')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (logsError) throw logsError;

        if (logsData && logsData.length > 0) {
          setLatestTurnIndex(logsData[0].turn_index);
        }

        setLoading(false);
      } catch (err: unknown) {
        console.error('Error fetching initial data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchInitialData();

    // Set up Realtime subscriptions
    const logsChannel = supabase
      .channel(`discussion-logs-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discussion_logs',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log('Discussion logs change:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newLog = payload.new as DiscussionLog;
            // Update latest turn_index if this message is newer
            setLatestTurnIndex((prev) => Math.max(prev, newLog.turn_index));
          }
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel(`discussion-participants-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discussion_participants',
          filter: `project_id=eq.${projectId}`,
        },
        async (payload) => {
          console.log('Discussion participants change:', payload);
          // Refetch participants on any change
          await fetchInitialData();
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [projectId, supabase]);

  // Calculate active sequence based on turn_index
  const activeSequence = latestTurnIndex + 1;

  // Get status for a participant
  const getParticipantStatus = (participant: Participant) => {
    if (latestTurnIndex === -1 && participant.role === 'leader') {
      return {
        text: 'Preparing Data...',
        icon: '⚙️',
        isActive: true,
        color: 'text-blue-400',
      };
    }

    if (participant.sequence_order === activeSequence) {
      if (participant.role === 'user') {
        return {
          text: 'Awaiting User Input',
          icon: '⏰',
          isActive: true,
          color: 'text-amber-400',
        };
      } else {
        return {
          text: 'Thinking... (Claude)',
          icon: '💭',
          isActive: true,
          color: 'text-emerald-400',
        };
      }
    }

    if (participant.sequence_order < activeSequence) {
      return {
        text: 'Completed',
        icon: '✓',
        isActive: false,
        color: 'text-green-400',
      };
    }

    return {
      text: 'Waiting...',
      icon: '⏳',
      isActive: false,
      color: 'text-slate-400',
    };
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'manager':
        return '👔';
      case 'leader':
        return '🎯';
      case 'specialist':
        return '👨‍💼';
      case 'user':
        return '👤';
      default:
        return '•';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Agent Status Monitor
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Agent Status Monitor
        </h3>
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">
          Agent Status Monitor
        </h3>
        <div className="text-slate-400 text-sm">
          No participants yet. Start a discussion to see agent status.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">
        Agent Status Monitor
      </h3>

      <div className="space-y-2">
        {participants.map((participant) => {
          const status = getParticipantStatus(participant);
          const roleIcon = getRoleIcon(participant.role);

          return (
            <div
              key={participant.id}
              className={`
                p-3 rounded-lg border transition-all
                ${
                  status.isActive
                    ? 'border-emerald-500/40 bg-emerald-950/30 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-700 bg-slate-800/30'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{roleIcon}</span>
                    <span className="text-sm font-medium text-slate-200">
                      {participant.sequence_order}. {participant.agent_name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-7">
                    <span className="text-base">{status.icon}</span>
                    <span className={`text-sm ${status.color}`}>
                      {status.text}
                    </span>
                  </div>

                  {/* Pulsing animation for active "thinking" agent */}
                  {status.isActive && participant.role !== 'user' && latestTurnIndex !== -1 && (
                    <div className="flex gap-1 ml-7 mt-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse delay-150"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Turn index indicator */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="text-xs text-slate-400">
          Current Turn Index: {latestTurnIndex === -1 ? 'Setup' : latestTurnIndex}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Active Sequence: {latestTurnIndex === -1 ? 'System' : activeSequence}
        </div>
      </div>
    </div>
  );
}

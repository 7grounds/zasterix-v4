import React, { useEffect, useState } from 'react';
// Wir importieren den Client direkt aus deiner Konfigurationsdatei
// Falls die Datei anders heißt (z.B. supabaseClient.ts), passe den Namen unten an.
import { supabase } from './lib/supabase'; 

interface Agent {
  agent_id: string;
  agent_name: string;
  agent_cluster: string;
  agent_code: string;
}

export default function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        // Wir rufen die RPC-Funktion auf, die wir in Supabase erstellt haben
        const { data, error: fetchError } = await supabase.rpc('get_active_agents');
        
        if (fetchError) throw fetchError;
        
        setAgents(data || []);
      } catch (err: any) {
        console.error('Origo-Error:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  if (loading) {
    return <div className="p-10 text-center animate-pulse text-gray-500">Verbinde mit Origo-Netzwerk...</div>;
  }

  if (error) {
    return (
      <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-xl">
        <h2 className="text-red-800 font-bold">Verbindungsfehler</h2>
        <p className="text-red-600 text-sm">{error}</p>
        <p className="mt-4 text-xs text-gray-500 italic">
          Tipp: Stelle sicher, dass die SQL-Funktion "get_active_agents" in Supabase veröffentlicht wurde.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">
          Origo <span className="text-blue-600">Agents</span>
        </h1>
        <div className="h-1 w-20 bg-blue-600 mt-2"></div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {agents.length === 0 ? (
          <div className="col-span-full p-12 text-center border-2 border-dashed rounded-2xl text-gray-400">
            Keine aktiven Agenten-Instanzen gefunden.
          </div>
        ) : (
          agents.map((agent) => (
            <div 
              key={agent.agent_id} 
              className="group p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border-l-4"
              style={{ borderLeftColor: 
                agent.agent_cluster === 'Core' ? '#8b5cf6' : 
                agent.agent_cluster === 'Operations' ? '#3b82f6' : '#10b981' 
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                  {agent.agent_cluster}
                </span>
                <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
              </div>
              <h2 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                {agent.agent_name}
              </h2>
              <p className="text-xs font-mono text-gray-400 mt-1">{agent.agent_code}</p>
              
              <div className="mt-6 flex justify-end">
                <div className="text-[10px] font-mono text-gray-300">ID: {agent.agent_id.slice(0,8)}...</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

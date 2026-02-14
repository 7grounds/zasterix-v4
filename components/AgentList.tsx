import React, { useEffect, useState } from 'react';
// Wir importieren den Client aus deiner Datei im Unterordner 'lib'
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
        // Aufruf der RPC-Funktion aus der Datenbank
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
    return <div className="p-10 text-center animate-pulse text-gray-500">Verbindung zum Origo-Schwarm wird hergestellt...</div>;
  }

  if (error) {
    return (
      <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-xl">
        <h2 className="text-red-800 font-bold">Verbindungsfehler</h2>
        <p className="text-red-600 text-sm">{error}</p>
        <p className="mt-4 text-xs text-gray-500 italic">
          Tipp: Prüfe, ob die SQL-Funktion "get_active_agents" in Supabase korrekt angelegt wurde.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic">
          Origo <span className="text-blue-600">Agents</span>
        </h1>
        <div className="h-1.5 w-24 bg-blue-600 mt-2"></div>
        <p className="text-xs text-gray-400 mt-4 font-mono">Status: Live-Datenbank-Synchronisierung aktiv</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {agents.length === 0 ? (
          <div className="col-span-full p-20 text-center border-2 border-dashed rounded-3xl text-gray-400 bg-gray-50">
            <p>Keine aktiven Agenten im System gefunden.</p>
            <p className="text-xs mt-2">Stelle sicher, dass Agenten in 'agent_templates' auf 'is_instance = true' stehen.</p>
          </div>
        ) : (
          agents.map((agent) => (
            <div 
              key={agent.agent_id} 
              className="group p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-500 border-l-8"
              style={{ borderLeftColor: 
                agent.agent_cluster === 'Core' ? '#8b5cf6' : 
                agent.agent_cluster === 'Operations' ? '#3b82f6' : '#10b981' 
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                  {agent.agent_cluster}
                </span>
                <div className="flex space-x-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-200"></div>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors duration-300">
                {agent.agent_name}
              </h2>
              
              <div className="mt-4 flex flex-col space-y-1">
                <span className="text-[10px] font-mono text-gray-400 bg-gray-50 p-1 rounded">Code: {agent.agent_code}</span>
                <span className="text-[10px] font-mono text-gray-300 truncate">UUID: {agent.agent_id}</span>
              </div>

              <div className="mt-8 flex justify-between items-center">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <button className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-wider">
                  Details öffnen →
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

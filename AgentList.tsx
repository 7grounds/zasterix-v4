import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Stelle sicher, dass dieser Pfad zu deinem Supabase-Client führt

// Typ-Definition für die Agenten (passend zur SQL-Funktion)
interface Agent {
  agent_id: string;
  agent_name: string;
  agent_cluster: string;
  agent_code: string;
}

const AgentList: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);
      try {
        // Aufruf der RPC-Funktion, die wir in Supabase angelegt haben
        const { data, error: fetchError } = await supabase.rpc('get_active_agents');

        if (fetchError) throw fetchError;

        setAgents(data || []);
      } catch (err: any) {
        console.error('Origo-Error:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-10 text-gray-500">
        <div className="animate-spin mr-2">🌀</div> Lade Origo-Schwarm...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">
        ⚠️ Fehler beim Laden der Agenten: {error}
      </div>
    );
  }

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Agenten-Verwaltung</h1>
        <p className="text-sm text-gray-500">Status: Dynamisch (Origo-Architektur)</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.length === 0 ? (
          <p className="col-span-full text-gray-400 italic">Keine aktiven Agenten-Instanzen gefunden.</p>
        ) : (
          agents.map((agent) => (
            <div 
              key={agent.agent_id} 
              className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow p-5"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-lg text-gray-800">{agent.agent_name}</h3>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                  agent.agent_cluster === 'Core' ? 'bg-purple-100 text-purple-700' :
                  agent.agent_cluster === 'Operations' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {agent.agent_cluster || 'Kein Cluster'}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center text-xs text-gray-400">
                  <span className="w-16">Code:</span>
                  <code className="bg-gray-50 px-1 rounded text-gray-600">{agent.agent_code}</code>
                </div>
                <div className="flex items-center text-xs text-gray-400">
                  <span className="w-16">ID:</span>
                  <span className="truncate">{agent.agent_id}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                <button className="text-xs text-blue-600 hover:underline">Details anzeigen</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgentList;

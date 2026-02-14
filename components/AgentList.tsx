'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Definition des Agenten-Typs für TypeScript
interface Agent {
  id: string;
  name: string;
  code_name: string;
  category: string;
  is_active: boolean;
  status: string;
}

export default function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      const { data, error } = await supabase
        .from('agent_templates')
        .select('id, name, code_name, category, is_active, status');
      
      if (error) {
        console.error('Fehler:', error);
      } else {
        setAgents((data as Agent[]) || []);
      }
      setLoading(false);
    }
    fetchAgents();
  }, []);

  if (loading) return <div className="p-10 text-gray-400 italic font-mono uppercase tracking-widest">Synchronisiere_Origo_Kern...</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-6 text-slate-800 uppercase tracking-widest">Agenten-Schwarm</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">
                {agent.code_name || 'NO_CODE'}
              </span>
              <div className={`h-2 w-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <h3 className="font-bold text-slate-900">{agent.name}</h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">{agent.category || 'Standard'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

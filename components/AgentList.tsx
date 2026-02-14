'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AgentList() {
  // Wir nutzen hier wieder ein flexibleres System, um den Typen-Fehler zu umgehen
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      // Wir fragen die Daten ab
      const { data, error } = await supabase
        .from('agent_templates')
        .select('*'); // Wir laden einfach alles, das ist sicherer für den Build
      
      if (error) {
        console.error('Fehler:', error);
      } else {
        setAgents(data || []);
      }
      setLoading(false);
    }
    fetchAgents();
  }, []);

  if (loading) return <div className="p-10 text-gray-400 italic font-mono uppercase tracking-widest">SYNCHRONISIERE_ORIGO_KERN...</div>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-6 text-slate-800 uppercase tracking-widest">Agenten-Schwarm</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent: any) => (
          <div key={agent.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">
                {agent.code_name || 'AGENT'}
              </span>
              <div className={`h-2 w-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <h3 className="font-bold text-slate-900">{agent.name || 'Unbenannter Agent'}</h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">{agent.category || 'Standard'}</p>
          </div>
        ))}
        {agents.length === 0 && (
          <div className="col-span-full p-10 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">
            Keine Agenten in der Datenbank gefunden.
          </div>
        )}
      </div>
    </div>
  );
}

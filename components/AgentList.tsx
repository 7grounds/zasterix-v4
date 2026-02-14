/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AgentList() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const { data, error } = await (supabase as any).from('agent_templates').select('*');
        if (error) console.error(error);
        else setAgents(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  if (loading) return <div className="p-10 font-mono text-slate-400">LOADING_CORE...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-4xl font-black italic tracking-tighter text-slate-900 uppercase">Agenten-Schwarm</h2>
        <p className="text-xs font-bold text-blue-600 tracking-widest mt-2 uppercase">Status: Aktiv verbunden</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent: any) => (
          <div key={agent.id} className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-mono bg-slate-900 text-white px-2 py-1 rounded-lg italic">
                {agent.code_name || 'UNIT'}
              </span>
              <div className={`h-3 w-3 rounded-full ${agent.is_active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 leading-tight mb-1">{agent.name}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{agent.category}</p>
            <div className="h-1 w-12 bg-slate-100 mb-4"></div>
            <p className="text-xs text-slate-500 italic line-clamp-2">{agent.system_prompt || 'Bereit für Instruktionen.'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

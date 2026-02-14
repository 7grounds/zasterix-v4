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
        const { data, error } = await (supabase as any)
          .from('agent_templates')
          .select('*');
        
        if (error) {
          console.error('Supabase Fehler:', error);
        } else {
          setAgents(data || []);
        }
      } catch (err) {
        console.error('System Fehler:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  if (loading) {
    return <div className="p-20 text-center text-slate-400 font-mono">SYNCHRONISIERE_KERN...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-10 border-b border-slate-100 pb-5">
        <h2 className="text-2xl font-black text-slate-900 uppercase italic">Agenten-Schwarm</h2>
        <p className="text-[10px] text-slate-400 font-mono mt-1">Status: Verbunden mit Supabase</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent: any) => (
          <div key={agent.id} className="bg-white border-2 border-slate-50 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between mb-4">
              <span className="text-[9px] font-mono bg-slate-900 text-white px-2 py-1 rounded">
                {agent.code_name || 'UNIT'}
              </span>
              <div className={`h-3 w-3 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <h3 className="font-bold text-slate-900 text-xl">{agent.name || 'Unbenannt'}</h3>
            <p className="text-[10px] text-slate-400 uppercase font-black mt-1">{agent.category || 'Standard'}</p>
          </div>
        ))}
      </div>

      {agents.length === 0 && (
        <div className="mt-10 p-10 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400">
          Keine Agenten gefunden.
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AgentList() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      // Flexibler Zugriff auf die Datenbank
      const { data, error } = await (supabase as any)
        .from('agent_templates')
        .select('*');
      
      if (error) {
        console.error('Fehler:', error);
      } else {
        setAgents(data || []);
      }
      setLoading(false);
    }
    fetchAgents();
  }, []);

  if (loading) return (
    <div className="p-20 text-center text-slate-400 font-mono text-sm animate-pulse">
      SYNCHRONISIERE_ORIGO_KERN...
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Agenten-Schwarm</h2>
          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1">Live-Anbindung: Supabase</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="h-2 w-2 bg-green-500 rounded-full animate-ping"></span>
          <span className="text-[10px] font-bold text-green-600 uppercase">System Online</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent: any) => (
          <div key={agent.id} className="bg-white border-2 border-slate-50 rounded-2xl p-6 shadow-sm hover:border-blue-500 hover:shadow-xl transition-all duration-300 group">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[9px] font-mono bg-slate-900 text-white px-2.5 py-1 rounded-md tracking-tighter">
                {agent.code_name || 'ORIGO-UNIT'}
              </span>
              <div className={`h-3 w-3 rounded-full ${agent.is_active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
            </div>
            <h3 className="font-bold text-slate-900 text-xl group-hover:text-blue-600 transition-colors">{agent.name || 'Unbenannt'}</h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">{agent.category || 'Standard'}</p>
            <div className="mt-6 pt-5 border-t border-slate-50">

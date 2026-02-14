/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function ManagerChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'manager', content: 'Manager Alpha online. Accessing agent templates. Ready for session trigger.' }
  ]);
  const [input, setInput] = useState('');
  const [sessionStep, setSessionStep] = useState(0); 
  const [activeLeader, setActiveLeader] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    
    setMessages(prev => [...prev, { role: 'user', content: cmd }]);
    setInput('');

    // --- PHASE 1: SUMMON LEADER & EXTRACT MODEL CONFIG ---
    if (cmd.toLowerCase().includes('session') && sessionStep === 0) {
      const { data: leader } = await supabase
        .from('agent_templates')
        .select('*')
        .eq('code_name', 'DISC_LEADER')
        .single();

      if (leader) {
        setActiveLeader(leader);
        
        // Check the model config column
        const config = leader.ai_model_config?.toLowerCase() || 'groq';
        const modelLabel = config.includes('open') ? 'OpenAI' : 'Groq';
        
        setMessages(prev => [...prev, { 
          role: 'manager', 
          content: `Summoning ${leader.name}. Engine: ${modelLabel}. Protocol: English.` 
        }]);
        
        setTimeout(() => {
          setMessages(prev => [...prev, { 
            role: 'leader', 
            content: `Discussion Leader active. Optimized via ${modelLabel}. \n\nWhat is the TOPIC of this session?` 
          }]);
          setSessionStep(1);
        }, 800);
      }
      return;
    }

    // --- PHASE 2: TOPIC & SWARM SUGGESTION ---
    if (sessionStep === 1) {
      const { data: swarm } = await supabase
        .from('agent_templates')
        .select('name, ai_model_config')
        .eq('is_active', true)
        .neq('code_name', 'DISC_LEADER');

      setTimeout(() => {
        const list = swarm && swarm.length > 0 
          ? swarm.map(a => `${a.name} (${a.ai_model_config || 'Groq'})`).join(', ') 
          : "Standard Units";

        setMessages(prev => [...prev, { 
          role: 'leader', 
          content: `Topic "${cmd}" analyzed. \n\nSuggested Swarm Composition: \n👥 ${list} \n\nConfirm lineup or request a NEW SPECIALIST?` 
        }]);
        setSessionStep(2);
      }, 700);
      return;
    } 

    // --- PHASE 3: START ---
    if (sessionStep === 2) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: 'leader', 
          content: `Session parameters finalized. \n\n>>> START.` 
        }]);
        setSessionStep(0);
      }, 600);
      return;
    }

    setMessages(prev => [...prev, { role: 'manager', content: 'Standing by.' }]);
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
      {/* Dynamic Status Header */}
      <div className="px-10 py-6 border-b border-slate-50 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <div className={`h-3 w-3 rounded-full ${activeLeader ? 'bg-orange-600 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-[11px] font-mono font-black uppercase tracking-[0.25em] text-slate-400">
            {activeLeader ? `ACTIVE_NODE: ${activeLeader.name}` : 'SYSTEM_STATUS: STANDBY'}
          </span>
        </div>
        {activeLeader && (
          <span className="text-[9px] font-bold text-orange-600 uppercase border border-orange-100 px-3 py-1 rounded-full bg-orange-50">
            {activeLeader.ai_model_config || 'Groq'} Enabled
          </span>
        )}
      </div>

      {/* Massive Chat Flow */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 md:p-20 space-y-12">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
            <div className={`max-w-[85%] md:max-w-[75%] p-10 rounded-[3rem] shadow-sm ${
              msg.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none' : 
              msg.role === 'leader' ? 'bg-slate-900 text-orange-400 rounded-tl-none border-l-8 border-orange-600 shadow-xl' : 
              'bg-slate-50 border border-slate-100 text-slate-900 rounded-tl-none'
            }`}>
              <p className="text-[10px] uppercase font-black tracking-widest mb-4 opacity-30">{msg.role}</p>
              <p className="text-2xl md:text-4xl italic font-medium leading-tight tracking-tight whitespace-pre-line">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Giant Command Input */}
      <div className="p-10 md:p-16 bg-white border-t border-slate-50 shadow-2xl">
        <form onSubmit={sendCommand} className="max-w-6xl mx-auto relative group">
          <input 
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={activeLeader ? "Send to Leader..." : "Master Command..."} 
            className="w-full bg-slate-100 rounded-[3rem] px-12 py-8 text-2xl md:text-3xl outline-none border-none shadow-inner focus:bg-white transition-all font-medium italic"
          />
          <button className="absolute right-4 top-4 bottom-4 aspect-square bg-orange-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all">
            <span className="text-3xl">🚀</span>
          </button>
        </form>
      </div>
    </div>
  );
}

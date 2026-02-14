/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function ManagerChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'manager', content: 'Manager Alpha online. Groq pipeline ready. Awaiting instructions.' }
  ]);
  const [input, setInput] = useState('');
  const [sessionStep, setSessionStep] = useState(0); 
  const [roundCount, setRoundCount] = useState(0);
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

    // --- PHASE 1: SUMMON DISCUSSION LEADER VIA DB ---
    if (cmd.toLowerCase().includes('session') && sessionStep === 0) {
      const { data: leader } = await supabase
        .from('agent_templates')
        .select('*')
        .eq('code_name', 'DISC_LEADER_a1db0818-1eb5-48d3-adb9-2efb01c74d36')
        .single();

      if (leader) {
        setActiveLeader(leader);
        const config = leader.ai_model_config || {};
        
        setMessages(prev => [...prev, { 
          role: 'manager', 
          content: `Protocol active: ${config.max_lines || 4} lines / ${config.max_rounds || 3} rounds. Summoning ${leader.name}...` 
        }]);
        
        // Simulation of the Leader starting the discussion
        setTimeout(() => {
          setMessages(prev => [...prev, { 
            role: 'leader', 
            content: `Discussion Leader engaged. Round 1 of ${config.max_rounds || 3} begins.\nWhat is the primary objective for this swarm session?` 
          }]);
          setSessionStep(1);
          setRoundCount(1);
        }, 800);
      }
      return;
    }

    // --- PHASE 2: ROUND TRACKING (4 LINES / 3 ROUNDS) ---
    if (sessionStep === 1 && activeLeader) {
      const config = activeLeader.ai_model_config || {};
      const nextRound = roundCount + 1;

      if (nextRound > (config.max_rounds || 3)) {
        setMessages(prev => [...prev, { role: 'leader', content: '>>> SESSION COMPLETE. 3 Rounds concluded.' }]);
        setSessionStep(0);
        setRoundCount(0);
        setActiveLeader(null);
      } else {
        setRoundCount(nextRound);
        setMessages(prev => [...prev, { 
          role: 'leader', 
          content: `Round ${nextRound}: Rotating focus to next specialized agent.\nAnalyzing owner input "${cmd}" for technical feasibility.\nMaintaining 4-line protocol constraint.\nOwner, please verify or redirect.` 
        }]);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans overflow-hidden">
      {/* Header with DB Status */}
      <div className="px-10 py-6 border-b border-slate-50 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <div className={`h-3 w-3 rounded-full ${activeLeader ? 'bg-orange-600 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-[11px] font-mono font-black uppercase tracking-[0.25em] text-slate-400 italic">
            {activeLeader ? `NODE: ${activeLeader.name} | ROUND ${roundCount}` : 'NODE: MANAGER_ALPHA'}
          </span>
        </div>
      </div>

      {/* Massive Chat Flow */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 md:p-20 space-y-12 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:30px_30px]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-8 duration-700`}>
            <div className={`max-w-[90%] md:max-w-[80%] p-12 rounded-[3.5rem] shadow-sm ${
              msg.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none' : 
              msg.role === 'leader' ? 'bg-slate-900 text-orange-400 rounded-tl-none border-l-[12px] border-orange-600 shadow-2xl' : 
              'bg-white border border-slate-100 text-slate-900 rounded-tl-none'
            }`}>
              <p className="text-[11px] uppercase font-black tracking-[0.4em] mb-6 opacity-30 italic">{msg.role}</p>
              <p className="text-3xl md:text-5xl italic font-medium leading-[1.05] tracking-tighter whitespace-pre-line">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Extreme Input Area */}
      <div className="p-12 md:p-20 bg-white border-t border-slate-100">
        <form onSubmit={sendCommand} className="max-w-7xl mx-auto relative group">
          <input 
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={activeLeader ? "Interrupt or contribute..." : "Enter command..."} 
            className="w-full bg-slate-50 rounded-[4rem] px-16 py-12 text-3xl md:text-5xl outline-none border-none shadow-inner focus:bg-white transition-all font-medium italic tracking-tighter"
          />
          <button className="absolute right-6 top-6 bottom-6 aspect-square bg-orange-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all">
            <span className="text-5xl">🚀</span>
          </button>
        </form>
      </div>
    </div>
  );
}

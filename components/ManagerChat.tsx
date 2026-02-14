 /* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function ManagerChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: 'Manager Alpha online. Origo-V4 protocol ready.' }
  ]);
  const [input, setInput] = useState('');
  const [activeLeader, setActiveLeader] = useState<any>(null);
  const [round, setRound] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: cmd }]);
    setInput('');

    let currentAgent = activeLeader;

    // DETECT SESSION TRIGGER (Discussion Leader UUID)
    if (cmd.toLowerCase().includes('session') && !activeLeader) {
      const { data: leader } = await supabase
        .from('agent_templates')
        .select('*')
        .eq('code_name', 'DISC_LEADER_a1db0818-1eb5-48d3-adb9-2efb01c74d36')
        .single();

      if (leader) {
        const leaderData = leader as any;
        currentAgent = leaderData;
        setActiveLeader(leaderData);
        setRound(1);
        setMessages(prev => [...prev, { role: 'assistant', content: `Summoning Discussion Leader... (Round 1/3)` }]);
        return; // Initial fetch done
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cmd,
          agentId: currentAgent?.id,
          history: messages.slice(-10),
          aiModelConfig: currentAgent?.ai_model_config
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (activeLeader) {
        const config = (activeLeader as any).ai_model_config || {};
        const maxRounds = config.max_rounds || 3;
        const isLast = round >= maxRounds;
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.text + (isLast ? '\n\n>>> SESSION COMPLETE.' : '') 
        }]);

        if (isLast) {
          setActiveLeader(null);
          setRound(0);
        } else {
          setRound(prev => prev + 1);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `System Error: ${err.message}` }]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* HEADER STATUS */}
      <div className="px-10 py-6 border-b border-slate-100 flex justify-between bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className={`h-3 w-3 rounded-full ${activeLeader ? 'bg-orange-600 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
            {activeLeader ? `${(activeLeader as any).name} | ROUND ${round}/3` : 'MANAGER_ALPHA_STDBY'}
          </span>
        </div>
      </div>

      {/* CHAT CONTENT */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-16 space-y-12 bg-[radial-gradient(#f1f5f9_1px,transparent_1px)] [background-size:40px_40px]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            <div className={`max-w-[85%] p-10 rounded-[2.5rem] shadow-sm ${
              msg.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none' : 
              activeLeader ? 'bg-slate-900 text-orange-400 rounded-tl-none border-l-[12px] border-orange-600 shadow-2xl' : 
              'bg-white border border-slate-100 text-slate-900 rounded-tl-none'
            }`}>
              <p className="text-3xl md:text-5xl italic font-semibold leading-tight tracking-tighter whitespace-pre-line">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* INPUT FIELD */}
      <div className="p-10 md:p-14 bg-white border-t border-slate-50">
        <form onSubmit={handleAction} className="max-w-5xl mx-auto relative">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeLeader ? "Contribute to session..." : "Master command..."} 
            className="w-full bg-slate-50 rounded-[4rem] px-12 py-10 text-3xl md:text-4xl outline-none focus:bg-white transition-all italic font-medium tracking-tighter border-2 border-transparent focus:border-slate-100"
          />
          <button className="absolute right-6 top-6 bottom-6 aspect-square bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg hover:rotate-12 transition-transform active:scale-90">
            <span className="text-4xl">🚀</span>
          </button>
        </form>
      </div>
    </div>
  );
}

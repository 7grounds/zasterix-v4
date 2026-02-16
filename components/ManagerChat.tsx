/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function ManagerChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: 'Manager Alpha online. xAI/Grok cluster active.' }
  ]);
  const [input, setInput] = useState('');
  const [activeLeader, setActiveLeader] = useState<any>(null);
  const [round, setRound] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    setMessages(prev => [...prev, { role: 'user', content: cmd }]);
    setInput('');

    let currentAgent = activeLeader;

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
        return; 
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cmd,
          agentId: currentAgent?.id,
          history: messages.slice(-10)
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

        if (isLast) { setActiveLeader(null); setRound(0); } else { setRound(prev => prev + 1); }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `System Error: ${err.message}` }]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e]">
      {/* Header */}
      <div className="px-10 py-6 border-b border-gray-800 flex justify-between bg-gray-950 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className={`h-3 w-3 rounded-full ${activeLeader ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">
            {activeLeader ? `${(activeLeader as any).name} | ROUND ${round}/3` : 'MANAGER_ALPHA_READY'}
          </span>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 bg-[#2f2f2f] chat-scroll">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-5 duration-300`}>
            <div className={`${msg.role === 'user' ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[80%]'}`}>
              <div className={`p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-blue-900/30 border border-blue-500/30 text-gray-100' 
                  : activeLeader 
                  ? 'bg-gray-800/70 text-orange-400 border-l-4 border-orange-500' 
                  : 'bg-gray-800/50 text-gray-100'
              }`}>
                <p className="text-base md:text-lg leading-relaxed whitespace-pre-line">{msg.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gray-950 border-t border-gray-800 p-4 md:p-6">
        <form onSubmit={handleAction} className="max-w-5xl mx-auto relative">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={activeLeader ? "Contribute..." : "Master command..."} 
            className="w-full bg-gray-800 border border-gray-700 rounded-3xl px-6 py-4 text-base md:text-lg text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          <button 
            type="submit"
            className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
          >
            <span className="text-xl">🚀</span>
          </button>
        </form>
      </div>
    </div>
  );
}

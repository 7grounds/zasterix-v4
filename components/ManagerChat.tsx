/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function ManagerChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'manager', content: 'Manager Alpha online. System check complete. Awaiting instructions.' }
  ]);
  const [input, setInput] = useState('');
  const [sessionStep, setSessionStep] = useState(0); 
  const [sessionData, setSessionData] = useState({ topic: '', owner: '', partners: '' });
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

    setTimeout(async () => {
      // --- STEP 1: MANAGER CALLS LEADER ---
      if (cmd.toLowerCase().includes('session') && sessionStep === 0) {
        const { data: leader } = await supabase.from('agent_templates').select('*').eq('code_name', 'DISC_LEADER').single();
        if (leader) {
          setActiveLeader(leader);
          setMessages(prev => [...prev, { role: 'manager', content: `Understood. Summoning ${leader.name} for session preparation...` }]);
          
          setTimeout(() => {
            setMessages(prev => [...prev, { 
              role: 'leader', 
              content: `Discussion Leader active. I am taking over the structuring process. What is the primary TOPIC of this session?` 
            }]);
            setSessionStep(1);
          }, 1000);
        }
        return;
      }

      // --- STEP 2: ANALYZE TOPIC & PROPOSE AGENTS ---
      if (sessionStep === 1) {
        setSessionData(prev => ({ ...prev, topic: cmd }));
        
        const { data: availableAgents } = await supabase.from('agent_templates').select('name, category').neq('code_name', 'DISC_LEADER');
        
        let proposal = "";
        const lowerCmd = cmd.toLowerCase();
        if (lowerCmd.includes('code') || lowerCmd.includes('app') || lowerCmd.includes('dev')) {
          proposal = "Architect & Sentinel";
        } else if (lowerCmd.includes('marketing') || lowerCmd.includes('growth') || lowerCmd.includes('sales')) {
          proposal = "Growth Agent";
        } else {
          proposal = availableAgents ? availableAgents.map(a => a.name).join(', ') : "Special Task Force";
        }

        setTimeout(() => {
          setMessages(prev => [...prev, { 
            role: 'leader', 
            content: `Topic "${cmd}" analyzed. \n\nI propose the following lineup: \n👥 ${proposal} \n\nShould I summon these agents, or do we require a NEW CREATION?` 
          }]);
          setSessionStep(2);
        }, 800);
      } 
      
      // --- STEP 3: CONFIRMATION & START ---
      else if (sessionStep === 2) {
        setSessionData(prev => ({ ...prev, partners: cmd }));
        
        setTimeout(() => {
          setMessages(prev => [...prev, { 
            role: 'leader', 
            content: `Lineup confirmed: ${cmd}. \n\nAll parameters set. Opening communication channels.\n\n>>> START.` 
          }]);
          setSessionStep(0);
        }, 800);
      }
      else {
        if (!activeLeader) {
            setMessages(prev => [...prev, { role: 'manager', content: 'Standing by for further commands.' }]);
        }
      }
    }, 500);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Dynamic Header */}
      <div className="px-10 py-5 border-b border-slate-50 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className={`h-2.5 w-2.5 rounded-full ${activeLeader ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-slate-400">
            {activeLeader ? `DISCUSSION_LEADER_ACTIVE` : 'ORIGO_CORE_IDLE'}
          </span>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-16 space-y-12">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-500`}>
            <div className={`max-w-[85%] md:max-w-[70%] p-8 rounded-[2.5rem] shadow-sm ${
              msg.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none' : 
              msg.role === 'leader' ? 'bg-slate-900 text-orange-400 rounded-tl-none border-l-4 border-orange-500 shadow-xl' : 
              'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              <p className="text-[10px] uppercase font-black tracking-widest mb-3 opacity-40">
                {msg.role === 'leader' ? 'Discussion Leader' : msg.role === 'manager' ? 'Manager Alpha' : 'Owner'}
              </p>
              <p className="text-xl md:text-2xl italic font-medium leading-relaxed tracking-tight whitespace-pre-line">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-8 md:p-12 bg-white border-t border-slate-100">
        <form onSubmit={sendCommand} className="max-w-6xl mx-auto relative group">
          <input 
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={activeLeader ? "Message to Leader..." : "Enter command..."} 
            className="w-full bg-slate-100 rounded-[2.5rem] px-10 py-7 text-xl md:text-2xl outline-none border-none shadow-inner focus:bg-white focus:ring-4 focus:ring-orange-50 transition-all"
          />
          <button className="absolute right-4 top-4 bottom-4 aspect-square bg-orange-600 text-white rounded-full flex items-center justify-center hover:bg-orange-500 transition-all shadow-xl active:scale-95">
            <span className="text-2xl">🚀</span>
          </button>
        </form>
      </div>
    </div>
  );
}

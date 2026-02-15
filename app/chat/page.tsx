"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Message {
  role: "user" | "assistant" | "system";
  text: string;
  title: string;
}

interface DiscussionLog {
  created_at: string;
  speaker_name: string;
  content: string;
}

export default function OrigoChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // FIX: Strikte Typisierung ohne 'any'
  const [logs, setLogs] = useState<DiscussionLog[]>([]);
  
  const projectId = "98d9b300-c908-411c-8114-0917b49372da"; 
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    fetchLogs();
  }, [messages]);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('discussion_logs')
      .select('created_at, speaker_name, content')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    
    if (data) {
      setLogs(data as DiscussionLog[]);
    }
  };

  const callApi = async (msg: string, title: string, currentHistory: Message[]) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        targetTitle: title,
        projectId: projectId,
        history: currentHistory.map(m => ({ role: m.role, content: m.text }))
      }),
    });
    return res.json();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", text: input, title: "OWNER" };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput("");
    setLoading(true);

    try {
      const data = await callApi(input, "Manager Alpha", updatedHistory);
      const leaderMsg: Message = { role: "assistant", text: data.text, title: data.title };
      let chainContext = [...updatedHistory, leaderMsg];
      setMessages(chainContext);

      const specialists = ["Designer", "DevOps"]; 
      let lastOutput = data.text;

      for (const agentName of specialists) {
        if (new RegExp(agentName, "i").test(lastOutput)) {
          const specData = await callApi(input, agentName, chainContext);
          const specMsg: Message = { role: "assistant", text: specData.text, title: specData.title };
          chainContext = [...chainContext, specMsg];
          setMessages(chainContext);
          lastOutput = specData.text;
        }
      }

      if (chainContext.length > updatedHistory.length + 1) {
        const sumData = await callApi("Summarize the final decisions.", "Manager Alpha", chainContext);
        setMessages(prev => [...prev, { role: "assistant", text: sumData.text, title: "SUMMARY" }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "system", text: "Sync Error.", title: "SYSTEM" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-slate-300 font-mono text-xs">
      <header className="p-4 border-b border-slate-900 bg-black">
        <span className="text-sky-500 font-bold uppercase tracking-widest">Origo V4 // Stable Build</span>
      </header>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`border-l pl-4 ${msg.title === 'OWNER' ? 'border-slate-800' : 'border-sky-900'}`}>
            <div className="text-[10px] text-sky-600 mb-1 font-black">{msg.title}</div>
            <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>
          </div>
        ))}
        {loading && <div className="animate-pulse text-sky-500 uppercase">Syncing...</div>}
        
        <div className="mt-12 pt-6 border-t border-slate-900">
          <div className="text-slate-600 mb-4 tracking-tighter uppercase font-bold">Meeting Log Table</div>
          <table className="w-full text-left opacity-60">
            <thead>
              <tr className="border-b border-slate-900 text-[10px]">
                <th className="pb-2">TIMESTAMP</th>
                <th className="pb-2">AGENT</th>
                <th className="pb-2">LOG_CONTENT</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-b border-slate-900/50">
                  <td className="py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="py-2 text-sky-900 font-bold">{l.speaker_name}</td>
                  <td className="py-2 italic line-clamp-1">{l.content.slice(0, 60)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div ref={scrollRef} />
      </div>

      <footer className="p-6 border-t border-slate-900 bg-black">
        <form onSubmit={sendMessage} className="flex gap-4 max-w-4xl mx-auto">
          <input 
            className="flex-1 bg-transparent border-b border-slate-800 focus:border-sky-500 outline-none py-1 transition-all"
            value={input} onChange={(e) => setInput(e.target.value)} 
            placeholder="System Command..."
            disabled={loading}
          />
          <button type="submit" disabled={loading} className="text-sky-500 font-bold uppercase hover:text-white">Execute</button>
        </form>
      </footer>
    </div>
  );
}

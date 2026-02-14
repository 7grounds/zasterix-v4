"use client";

import React, { useState, useEffect, useRef } from 'react';

/**
 * @MODULE_ID app.chat.page
 * @VERSION Origo-V4-Serious-UI
 */

export default function OrigoChat() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetAgent, setTargetAgent] = useState("Discussion Leader"); // L1 Default
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", text: input, title: "OWNER" };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          targetTitle: targetAgent,
          history: messages.map(m => ({ role: m.role, content: m.text }))
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", text: data.text, title: data.title }]);
    } catch {
      setMessages(prev => [...prev, { role: "system", text: "Connection failed.", title: "SYSTEM" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-[#e2e8f0] font-sans">
      {/* Header */}
      <header className="p-4 border-bottom border-[#1e293b] flex justify-between items-center bg-[#111827]">
        <h1 className="text-xs font-bold tracking-widest uppercase text-sky-500">Origo Operational Interface</h1>
        <div className="text-[10px] text-slate-500 uppercase">Status: Groq Cluster Active</div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className="group border-l-2 border-[#1e293b] hover:border-sky-500/50 pl-4 py-2 transition-colors">
            <div className={`text-[10px] font-bold uppercase tracking-tighter mb-1 ${
              msg.title === "Discussion Leader" ? "text-sky-400" : 
              msg.title === "OWNER" ? "text-slate-400" : "text-emerald-400"
            }`}>
              {msg.title}
            </div>
            <div className="text-sm leading-relaxed text-slate-200">
              {msg.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-[10px] animate-pulse text-sky-500 uppercase">Processing...</div>}
        <div ref={scrollRef} />
      </div>

      {/* Footer / Input */}
      <footer className="p-4 bg-[#111827] border-t border-[#1e293b]">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-4">
          <select 
            value={targetAgent}
            onChange={(e) => setTargetAgent(e.target.value)}
            className="bg-[#1e293b] border border-[#334155] text-[10px] uppercase font-bold px-2 py-2 rounded text-slate-300 outline-none"
          >
            <option value="Discussion Leader">L1: Leader</option>
            <option value="Software Developer">L2: Dev</option>
            <option value="Marketing Expert">L2: Marketing</option>
          </select>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter strategic command..."
            className="flex-1 bg-transparent border-b border-[#334155] focus:border-sky-500 outline-none text-sm py-2 transition-all"
          />
          <button type="submit" className="text-xs font-bold uppercase text-sky-500 hover:text-sky-400 transition-colors">
            Execute
          </button>
        </form>
      </footer>
    </div>
  );
}

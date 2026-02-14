"use client";
import React, { useState, useEffect, useRef } from 'react';

/** * @MODULE_ID app.chat.page
 * @VERSION Origo-V4-Complete-Final
 */

interface Message {
  role: "user" | "assistant" | "system";
  text: string;
  title: string;
}

export default function OrigoChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    scrollRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [messages]);

  const callApi = async (msg: string, title: string, currentHistory: Message[]) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        targetTitle: title,
        history: currentHistory.map(m => ({ role: m.role, content: m.text }))
      }),
    });
    return res.json();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", text: input, title: "OWNER" };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // 1. Call Discussion Leader
      const data = await callApi(input, "Discussion Leader", updatedMessages);
      const leaderMsg: Message = { role: "assistant", text: data.text, title: data.title };
      setMessages(prev => [...prev, leaderMsg]);

      // 2. Auto-Summon Logic
      let specialist = "";
      if (data.text.toLowerCase().includes("software developer")) specialist = "Software Developer";
      else if (data.text.toLowerCase().includes("marketing expert")) specialist = "Marketing Expert";

      if (specialist) {
        const specData = await callApi(`Leader requested input for: ${input}`, specialist, [...updatedMessages, leaderMsg]);
        setMessages(prev => [...prev, { role: "assistant", text: specData.text, title: specData.title }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "system", text: "Link Error.", title: "SYSTEM" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-[#e2e8f0]">
      <header className="p-4 border-b border-[#1e293b] bg-[#111827] text-[10px] font-bold tracking-widest text-sky-500 uppercase">
        Origo Command Center
      </header>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className="border-l border-[#1e293b] pl-4 py-1">
            <div className={`text-[9px] font-black uppercase mb-1 ${
              msg.title === 'Discussion Leader' ? 'text-sky-400' : 
              msg.title === 'OWNER' ? 'text-slate-500' : 'text-emerald-400'
            }`}>
              {msg.title}
            </div>
            <div className="text-sm font-light text-slate-300">{msg.text}</div>
          </div>
        ))}
        {loading && <div className="text-[9px] animate-pulse text-sky-500">ROUTING...</div>}
        <div ref={scrollRef} />
      </div>

      <footer className="p-4 bg-[#111827] border-t border-[#1e293b]">
        <form onSubmit={sendMessage} className="flex gap-4 max-w-4xl mx-auto">
          <input 
            className="flex-1 bg-transparent border-b border-[#334155] focus:border-sky-500 outline-none text-sm py-1"
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Submit Command..."
          />
          <button type="submit" className="text-[10px] font-bold text-sky-500 uppercase">
            Execute
          </button>
        </form>
      </footer>
    </div>
  );
}

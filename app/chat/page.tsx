 "use client";
import React, { useState, useEffect, useRef } from 'react';

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
      // 1. Initial Call to Manager Alpha
      const data = await callApi(input, "Manager Alpha", updatedMessages);
      const leaderMsg: Message = { role: "assistant", text: data.text, title: data.title };
      let currentContext = [...updatedMessages, leaderMsg];
      setMessages(currentContext);

      // 2. Round Table Chain: Check for specialists
      const specialists = ["Designer", "DevOps"];
      let lastAgentOutput = data.text;

      for (const agentName of specialists) {
        if (new RegExp(agentName, "i").test(lastAgentOutput)) {
          const specData = await callApi(
            `Continue the session based on: ${lastAgentOutput}`,
            agentName,
            currentContext
          );
          const specMsg: Message = { role: "assistant", text: specData.text, title: specData.title };
          currentContext = [...currentContext, specMsg];
          setMessages(currentContext);
          lastAgentOutput = specData.text;
        }
      }
    } catch (_err) {
      setMessages(prev => [...prev, { role: "system", text: "Connection Lost.", title: "SYSTEM" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-300 font-mono">
      <header className="p-4 border-b border-slate-800 bg-black flex justify-between items-center">
        <span className="text-xs font-bold tracking-[0.3em] text-sky-500 uppercase">Origo V4 // Round Table</span>
      </header>
      
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`max-w-4xl mx-auto border-l-2 pl-6 py-2 ${
            msg.title === 'OWNER' ? 'border-slate-700' : 'border-sky-900'
          }`}>
            <div className={`text-[10px] font-bold uppercase mb-2 ${
              msg.title === 'OWNER' ? 'text-slate-500' : 'text-sky-400'
            }`}>
              {msg.title}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
          </div>
        ))}
        {loading && <div className="text-[10px] animate-pulse text-sky-500 ml-8 italic">SYNCING_CLUSTER...</div>}
        <div ref={scrollRef} />
      </div>

      <footer className="p-6 bg-black border-t border-slate-900">
        <form onSubmit={sendMessage} className="flex gap-4 max-w-4xl mx-auto">
          <input 
            className="flex-1 bg-transparent border-b border-slate-700 focus:border-sky-500 outline-none text-sm py-2 transition-all"
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Command Alpha..."
          />
          <button type="submit" className="text-xs font-black text-sky-500 hover:text-white uppercase tracking-tighter">
            Execute
          </button>
        </form>
      </footer>
    </div>
  );
}

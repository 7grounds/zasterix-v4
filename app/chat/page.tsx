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
  const [projectId, setProjectId] = useState<string | null>(null); // Verknüpfung zu public.projects
  const scrollRef = useRef<HTMLDivElement>(null);

  // Automatischer Scroll zum Ende der Diskussion
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Zentraler API-Call mit History-Injektion
  const callApi = async (msg: string, title: string, currentHistory: Message[]) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        targetTitle: title,
        projectId: projectId, // Wichtig für discussion_logs
        history: currentHistory.map(m => ({
          role: m.role,
          content: m.text
        }))
      }),
    });
    return res.json();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    // 1. User Nachricht zum State hinzufügen
    const userMsg: Message = { role: "user", text: input, title: "OWNER" };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput("");
    setLoading(true);

    try {
      // 2. Erster Call: Manager Alpha (L1 Orchestrator)
      const data = await callApi(input, "Manager Alpha", updatedHistory);
      const leaderMsg: Message = { role: "assistant", text: data.text, title: data.title };
      
      // Update Context für die Kette
      let chainContext = [...updatedHistory, leaderMsg];
      setMessages(chainContext);

      // 3. Round-Table Logik: Rekursive Prüfung auf Spezialisten
      // Diese Namen müssen exakt so in public.agent_templates stehen
      const specialists = ["Designer", "DevOps"]; 
      let lastOutput = data.text;

      for (const agentName of specialists) {
        // Prüft, ob der vorherige Agent den nächsten Agenten erwähnt hat
        if (new RegExp(agentName, "i").test(lastOutput)) {
          const specData = await callApi(
            input, // Ursprünglicher Prompt bleibt Fokus
            agentName,
            chainContext // Das "total Gesagte" wird mitgegeben
          );

          const specMsg: Message = { 
            role: "assistant", 
            text: specData.text, 
            title: specData.title 
          };

          // Kontext für den nächsten Schleifendurchlauf erweitern
          chainContext = [...chainContext, specMsg];
          setMessages(chainContext);
          lastOutput = specData.text;
        }
      }
    } catch {
      setMessages(prev => [...prev, { 
        role: "system", 
        text: "Kritischer Fehler im Origo-Link.", 
        title: "SYSTEM" 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-300 font-mono text-sm">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-black flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          <span className="text-xs font-bold tracking-[0.3em] text-sky-500 uppercase">
            Origo V4 // Discussion Engine
          </span>
        </div>
      </header>
      
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {messages.map((msg, i) => (
          <div key={i} className={`max-w-4xl mx-auto border-l-2 pl-6 py-2 transition-all ${
            msg.title === 'OWNER' ? 'border-slate-700 opacity-80' : 'border-sky-900'
          }`}>
            <div className={`text-[10px] font-black uppercase mb-2 tracking-widest ${
              msg.title === 'OWNER' ? 'text-slate-500' : 'text-sky-400'
            }`}>
              {msg.title}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="max-w-4xl mx-auto text-[10px] animate-pulse text-sky-500 italic uppercase">
            Verarbeite Cluster-Logik...
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <footer className="p-6 bg-black border-t border-slate-900">
        <form onSubmit={sendMessage} className="flex gap-4 max-w-4xl mx-auto">
          <input 
            className="flex-1 bg-transparent border-b border-slate-700 focus:border-sky-500 outline-none py-2 transition-all placeholder:text-slate-700"
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="System-Befehl eingeben..."
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading}
            className={`text-xs font-black uppercase tracking-tighter transition-colors ${
              loading ? 'text-slate-700' : 'text-sky-500 hover:text-white'
            }`}
          >
            Execute
          </button>
        </form>
      </footer>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect, useRef } from 'react';

export default function ManagerChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'manager', content: 'Discussion Leader Alpha online. Ich koordiniere den Schwarm für Sie. Welches Ziel verfolgen wir heute?' }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Automatischer Scroll nach unten bei neuen Nachrichten
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');
    
    // Mock-Antwort vom Manager (Hier kommt später die KI-Logik)
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'manager', 
        content: `Befehl erhalten: "${input}". Ich analysiere die Kapazitäten im Schwarm und delegiere die Aufgaben an Architect und Sentinel.` 
      }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Chat History: Riesig und komfortabel */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 md:p-16 space-y-10 scroll-smooth"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
            <div className={`max-w-[80%] md:max-w-[70%] p-8 rounded-[2.5rem] shadow-sm ${
              msg.role === 'user' 
                ? 'bg-orange-600 text-white rounded-tr-none' 
                : 'bg-slate-50 border border-slate-100 text-slate-900 rounded-tl-none'
            }`}>
              <div className="flex items-center space-x-2 mb-3 opacity-50">
                <span className="text-[10px] uppercase font-black tracking-[0.2em]">
                  {msg.role === 'user' ? 'Inhaber / Master' : 'Manager Alpha'}
                </span>
                <div className={`h-1.5 w-1.5 rounded-full ${msg.role === 'user' ? 'bg-white' : 'bg-orange-500'}`}></div>
              </div>
              <p className="text-xl md:text-2xl font-medium leading-relaxed italic tracking-tight">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input Bereich: Fest am Boden, Clean Design */}
      <div className="p-8 md:p-12 bg-white/80 backdrop-blur-md border-t border-slate-100">
        <form onSubmit={sendCommand} className="max-w-6xl mx-auto relative group">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Schreiben Sie einen Befehl an den Discussion Leader..."
            className="w-full bg-slate-100 hover:bg-slate-200 focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all rounded-[2.5rem] px-10 py-6 text-xl md:text-2xl outline-none border-none font-medium shadow-inner"
          />
          <button className="absolute right-3 top-3 bottom-3 aspect-square bg-orange-600 text-white rounded-full flex items-center justify-center hover:bg-orange-500 hover:scale-105 transition-all shadow-xl active:scale-95">
            <span className="text-2xl">🚀</span>
          </button>
        </form>
        <p className="text-center mt-4 text-[10px] text-slate-400 font-mono uppercase tracking-widest">
          Origo-Core v4.0.1 // Multi-Agent-System Online
        </p>
      </div>
    </div>
  );
}

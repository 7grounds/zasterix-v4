"use client";

import { useState } from "react";

export default function DebugPage() {
  const [status, setStatus] = useState("Bereit für Test");
  const [response, setResponse] = useState("");

  const runTest = async () => {
    setStatus("Sende Request...");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: "PING", 
          projectId: "98d9b300-c908-411c-8114-0917b49372da" 
        }),
      });
      
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
      setStatus("Erfolg!");
    } catch (err) {
      setStatus("FEHLER!");
      // Sicherer Zugriff auf die Fehlermeldung ohne 'any'
      const errorMessage = err instanceof Error ? err.message : "Unbekannter Netzwerkfehler";
      setResponse(errorMessage);
    }
  };

  return (
    <div className="p-10 font-mono bg-black text-green-500 min-h-screen">
      <h1 className="text-2xl mb-5 uppercase tracking-tighter">Origo System Check</h1>
      
      <div className="mb-5 p-4 border border-green-900 bg-green-950/10">
        STATUS: <span className="text-white ml-2 uppercase">{status}</span>
      </div>

      <button 
        onClick={runTest}
        className="bg-green-700 text-black px-6 py-3 font-black uppercase hover:bg-green-500 transition-colors"
      >
        API Trigger (Ping)
      </button>

      <div className="mt-10">
        <div className="text-[10px] text-green-800 uppercase mb-2 tracking-widest font-bold">Raw Response Data:</div>
        <pre className="p-4 bg-gray-950 text-xs overflow-auto border border-green-900 text-green-400 min-h-[200px]">
          {response || "Warten auf Initialisierung..."}
        </pre>
      </div>
    </div>
  );
}

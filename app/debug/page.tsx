
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
    } catch (err: any) {
      setStatus("FEHLER!");
      setResponse(err.message || "Unbekannter Fehler");
    }
  };

  return (
    <div className="p-10 font-mono bg-black text-green-500 min-h-screen">
      <h1 className="text-2xl mb-5">ORIGO SYSTEM CHECK</h1>
      <div className="mb-5 p-4 border border-green-900">
        Status: <span className="text-white">{status}</span>
      </div>
      <button 
        onClick={runTest}
        className="bg-green-700 text-black px-4 py-2 font-bold hover:bg-green-500"
      >
        API TRIGGERN (PING)
      </button>
      <pre className="mt-10 p-4 bg-gray-900 text-xs overflow-auto border border-green-900">
        API-Antwort: {response || "Keine Daten"}
      </pre>
    </div>
  );
}

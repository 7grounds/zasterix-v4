'use client';
import { useState } from 'react';

export default function DiagnosticPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    try {
      // Direct call to the new simplified API below
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "System check: Confirm Grok 4 status." }),
      });
      const json = await res.json();
      setData(json);
    } catch (e) {
      setData({ error: "Local Network failure" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-cyan-400 p-20 font-mono">
      <h1 className="text-xl font-bold mb-6 border-b border-cyan-900 pb-2 tracking-[0.2em] uppercase">
        ORIGO_XAI_HANDSHAKE_v4
      </h1>
      
      <button 
        onClick={runTest}
        className="bg-cyan-600 text-black px-10 py-5 font-bold hover:bg-white transition-all rounded mb-10 uppercase text-xs"
      >
        {loading ? ">>> PROBING_CORE..." : ">>> EXECUTE_PING"}
      </button>

      <div className="bg-zinc-950 border border-cyan-900 p-10 rounded shadow-2xl">
        <p className="text-[10px] text-cyan-800 mb-4 tracking-[0.3em] uppercase font-black">
          // API_RESPONSE_LOG:
        </p>
        <pre className="text-sm whitespace-pre-wrap leading-relaxed">
          {data ? JSON.stringify(data, null, 2) : "System Idle. Awaiting User Input."}
        </pre>
      </div>
    </div>
  );
}

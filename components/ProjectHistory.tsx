import React, { useEffect, useState } from 'react';
// WICHTIG: ../ bedeutet "gehe einen Ordner zurück", um den lib-Ordner zu finden
import { supabase } from '../lib/supabase'; 

interface HistoryEntry {
  event_id: string;
  created_at: string;
  category: string;
  content: string;
  project_name: string;
}

export default function ProjectHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        // Wir rufen die RPC-Funktion auf
        const { data, error } = await supabase.rpc('get_project_history');
        if (error) throw error;
        setHistory(data || []);
      } catch (err) {
        console.error('History-Error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  if (loading) return <div className="p-10 text-center animate-pulse font-mono text-blue-500">ACCESSING CHRONICLER...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <header className="mb-12 border-b-2 border-blue-600 pb-6">
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">
          Project <span className="text-blue-600">Archive</span>
        </h1>
        <p className="text-gray-400 font-mono text-[10px] mt-1 italic">Origo Long-Term Memory Interface</p>
      </header>

      <div className="relative border-l-4 border-blue-100 ml-4 space-y-10">
        {history.length === 0 ? (
          <div className="pl-10 py-10 text-gray-400 italic">Die Chronik ist noch leer.</div>
        ) : (
          history.map((entry) => (
            <div key={entry.event_id} className="relative pl-10">
              <div className="absolute -left-[14px] top-2 h-6 w-6 rounded-full border-4 border-white bg-blue-600 shadow-md"></div>
              <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black text-white uppercase bg-blue-600 px-3 py-1 rounded-md">
                    {entry.category || 'LOG'}
                  </span>
                  <time className="text-[10px] text-gray-400 font-mono">
                    {new Date(entry.created_at).toLocaleString('de-DE')}
                  </time>
                </div>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">
                  Scope: {entry.project_name || 'Global System'}
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {entry.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

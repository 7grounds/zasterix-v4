import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

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

  if (loading) return <div className="p-10 text-center animate-pulse">Synchronisiere Chronik...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-10 flex justify-between items-end border-b pb-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">
            Project <span className="text-blue-600">Archive</span>
          </h1>
          <p className="text-gray-500 font-mono text-xs mt-1">Status: Chronicler Link Active</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full">
            Records: {history.length}
          </span>
        </div>
      </header>

      <div className="relative border-l-2 border-gray-100 ml-4 space-y-8">
        {history.map((entry) => (
          <div key={entry.event_id} className="relative pl-8">
            {/* Timeline Dot */}
            <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-sm"></div>
            
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                  {entry.category || 'General'}
                </span>
                <time className="text-[10px] text-gray-400 font-mono">
                  {new Date(entry.created_at).toLocaleString()}
                </time>
              </div>
              
              <h3 className="text-sm font-bold text-gray-700 mb-2">
                Projekt: {entry.project_name || 'System-Wide'}
              </h3>
              
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                {entry.content}
              </p>
            </div>
          </div>
        ))}
        
        {history.length === 0 && (
          <div className="pl-8 text-gray-400 italic text-sm">
            Die Chronik ist noch leer. Der Chronicler wartet auf den nächsten Sprint-Abschluss.
          </div>
        )}
      </div>
    </div>
  );
}

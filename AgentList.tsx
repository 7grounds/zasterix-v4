import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Dein Supabase-Client Pfad

export const useAgents = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      // Aufruf der neuen RPC-Funktion
      const { data, error } = await supabase.rpc('get_active_agents');
      
      if (error) {
        console.error('Origo-Error: Failed to fetch agents:', error);
      } else {
        setAgents(data);
      }
      setLoading(false);
    };

    fetchAgents();
  }, []);

  return { agents, loading };
};

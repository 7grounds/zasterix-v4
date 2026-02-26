/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function ManagerChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: 'Manager Alpha online. xAI/Grok cluster active.' }
  ]);
  const [input, setInput] = useState('');
  const [activeLeader, setActiveLeader] = useState<any>(null);
  const [round, setRound] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    // Quick command to check participants for a specific UUID
    // Usage: "check 19199f1d-e370-4f91-b0a4-2d0b992e5b94" or "19199f1d-e370-4f91-b0a4-2d0b992e5b94"
    const uuidPattern = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
    const uuidMatch = cmd.match(uuidPattern);
    
    if (uuidMatch) {
      const targetProjectId = uuidMatch[1];
      setMessages(prev => [...prev, { role: 'user', content: cmd }]);
      setInput('');
      
      console.log("🔍 Checking participants for UUID:", targetProjectId);
      try {
        const response = await fetch(`/api/discussions/${targetProjectId}/participants`);
        const data = await response.json();
        
        if (data.status === 'success' && data.participants) {
          let participantsMessage = `🎭 Diskussionsteilnehmer für Projekt ${targetProjectId}:\n\n`;
          participantsMessage += `Anzahl: ${data.count}\n\n`;
          
          data.participants.forEach((p: any) => {
            participantsMessage += `${p.sequence_order + 1}. ${p.name}\n`;
            participantsMessage += `   Rolle: ${p.role}\n`;
            participantsMessage += `   Disziplin: ${p.discipline || 'N/A'}\n`;
            if (p.category && p.category !== 'N/A') {
              participantsMessage += `   Kategorie: ${p.category}\n`;
            }
            participantsMessage += `\n`;
          });
          
          participantsMessage += `\n💡 Um dieses Projekt als aktuelles zu verwenden, gib ein: "use ${targetProjectId}"`;
          
          console.log("✅ Participants loaded:", data.count);
          setMessages(prev => [...prev, { role: 'assistant', content: participantsMessage }]);
        } else {
          console.error("❌ Failed to load participants:", data.message);
          setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.message || 'Konnte Teilnehmer nicht laden'}` }]);
        }
        return;
      } catch (err: any) {
        console.error("❌ Error fetching participants:", err);
        setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${err.message}` }]);
        return;
      }
    }

    // Command to set a project as active
    if (cmd.toLowerCase().startsWith('use ')) {
      const targetUuid = cmd.substring(4).trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidRegex.test(targetUuid)) {
        setMessages(prev => [...prev, { role: 'user', content: cmd }]);
        setInput('');
        setProjectId(targetUuid);
        console.log("✅ Active project set to:", targetUuid);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Projekt ${targetUuid} ist jetzt aktiv.\n\n💡 Gib "participants" ein, um die Teilnehmer zu sehen.` 
        }]);
        return;
      } else {
        setMessages(prev => [...prev, { role: 'user', content: cmd }]);
        setInput('');
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Ungültiges UUID-Format.' }]);
        return;
      }
    }

    // If no project exists yet and command looks like a project prompt, initialize project
    if (!projectId && cmd.toLowerCase().includes('session')) {
      setMessages(prev => [...prev, { role: 'user', content: cmd }]);
      setInput('');
      
      // Extract project name from command (simple extraction)
      const projectNameMatch = cmd.match(/session\s+(?:about|on|for)?\s*(.+)/i);
      const extractedName = projectNameMatch ? projectNameMatch[1].trim() : cmd;
      
      console.log("🚀 Initializing project...");
      console.log("   Project name:", extractedName);
      
      try {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Initializing project...' }]);
        
        const response = await fetch('/api/projects/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: extractedName || 'Discussion Project'
          })
        });

        const data = await response.json();
        
        console.log("📥 API Response:", data);
        
        if (data.status === 'success' && data.project) {
          const receivedProjectId = data.project.id;
          console.log("✅ Project initialized successfully!");
          console.log("   Project ID:", receivedProjectId);
          console.log("   Topic:", data.project.topic_objective || data.project.name);
          console.log("   Participants:", data.participants?.length || 0);
          
          setProjectId(receivedProjectId);
          
          // Load and display participants
          try {
            console.log("📝 Loading participant details...");
            const participantsResponse = await fetch(`/api/discussions/${receivedProjectId}`);
            const discussionData = await participantsResponse.json();
            
            let introMessage = `Project initialized!\n\nProject UUID: ${receivedProjectId}\nTopic: ${data.project.topic_objective || data.project.name}\nParticipants: ${data.participants?.length || 0}\n\n`;
            
            if (discussionData.status === 'success' && discussionData.speakerOrder) {
              introMessage += '🎭 Discussion Participants:\n';
              discussionData.speakerOrder.forEach((role: string, index: number) => {
                const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                introMessage += `${index + 1}. ${roleLabel}\n`;
              });
              introMessage += '\n';
            }
            
            introMessage += 'Ready to start discussion. Manager Alpha is standing by.\n\n';
            introMessage += '💡 Type your message to begin the discussion.';
            
            setMessages(prev => [
              ...prev.slice(0, -1), // Remove "Initializing..." message
              { 
                role: 'assistant', 
                content: introMessage
              }
            ]);
          } catch (err) {
            console.warn("⚠️  Could not load participant details:", err);
            // Fallback to basic message
            setMessages(prev => [
              ...prev.slice(0, -1),
              { 
                role: 'assistant', 
                content: `Project initialized!\n\nProject UUID: ${receivedProjectId}\nTopic: ${data.project.topic_objective || data.project.name}\nParticipants: ${data.participants?.length || 0}\n\nReady to start discussion. Manager Alpha is standing by.` 
              }
            ]);
          }
        } else {
          console.error("❌ Project initialization failed");
          console.error("   Error:", data.message);
          console.error("   Details:", data.details);
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: `Error: ${data.message || 'Failed to initialize project'}\n\n${data.details ? 'Details: ' + data.details : ''}` }
          ]);
        }
        return;
      } catch (err: any) {
        console.error("❌ System error during project initialization:", err);
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: `System Error: ${err.message}\n\nPlease check the console for details.` }
        ]);
        return;
      }
    }

    setMessages(prev => [...prev, { role: 'user', content: cmd }]);
    setInput('');

    // Handle "show participants" or "participants" command
    if (cmd.toLowerCase().includes('participant') || cmd.toLowerCase().includes('teilnehmer')) {
      if (!projectId) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Kein Projekt aktiv. Bitte starte zuerst eine Session.' }]);
        return;
      }

      console.log("📋 Fetching participants for project:", projectId);
      try {
        const response = await fetch(`/api/discussions/${projectId}/participants`);
        const data = await response.json();
        
        if (data.status === 'success' && data.participants) {
          let participantsMessage = `🎭 Diskussionsteilnehmer für Projekt ${projectId}:\n\n`;
          participantsMessage += `Anzahl: ${data.count}\n\n`;
          
          data.participants.forEach((p: any) => {
            participantsMessage += `${p.sequence_order + 1}. ${p.name}\n`;
            participantsMessage += `   Rolle: ${p.role}\n`;
            participantsMessage += `   Disziplin: ${p.discipline}\n`;
            if (p.category && p.category !== 'N/A') {
              participantsMessage += `   Kategorie: ${p.category}\n`;
            }
            participantsMessage += `\n`;
          });
          
          console.log("✅ Participants loaded:", data.count);
          setMessages(prev => [...prev, { role: 'assistant', content: participantsMessage }]);
        } else {
          console.error("❌ Failed to load participants:", data.message);
          setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.message || 'Konnte Teilnehmer nicht laden'}` }]);
        }
        return;
      } catch (err: any) {
        console.error("❌ Error fetching participants:", err);
        setMessages(prev => [...prev, { role: 'assistant', content: `Fehler: ${err.message}` }]);
        return;
      }
    }

    // Validate UUID format before allowing discussion
    if (projectId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(projectId)) {
        console.error("❌ Invalid project UUID format:", projectId);
        setMessages(prev => [
          ...prev, 
          { role: 'assistant', content: 'Error: Invalid project UUID format. Please initialize a new project.' }
        ]);
        return;
      }
    }

    // If we have a projectId, use the discussion API
    if (projectId) {
      console.log("📝 Sending message to discussion API");
      console.log("   Project ID:", projectId);
      console.log("   Message:", cmd);
      
      try {
        // Show "Manager Alpha is thinking..." status
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '🤔 Manager Alpha is thinking...\n\n(Processing your message and generating responses from discussion participants)' 
        }]);
        
        const response = await fetch(`/api/discussions/${projectId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cmd,
            userId: 'user-1', // TODO: Get from auth context
            organizationId: null
          })
        });

        const data = await response.json();
        console.log("📥 Discussion API response:", data);

        if (data.status === 'success') {
          // Remove "Manager is thinking..." message and add actual responses
          setMessages(prev => {
            const withoutProcessing = prev.slice(0, -1);
            const newEntries = data.entries || [];
            
            // Find the last few entries that are new (after the user's message)
            // Look for entries that came after the user message we just sent
            const userMessageIndex = newEntries.findIndex((entry: any) => 
              entry.content === cmd && entry.speakerRole === 'user'
            );
            
            // Get entries after the user message (agent responses)
            const newResponses = userMessageIndex >= 0 
              ? newEntries.slice(userMessageIndex + 1) 
              : newEntries.slice(-5); // Fallback to last 5 if not found
            
            // Convert entries to messages with better formatting
            const newMessages = newResponses.map((entry: any) => {
              const emoji = entry.speakerRole === 'manager' ? '👔' : 
                           entry.speakerRole === 'specialist' ? '🎓' : '👤';
              return {
                role: entry.speakerRole === 'user' ? 'user' : 'assistant',
                content: `${emoji} **${entry.speakerName}**:\n${entry.content}`
              };
            });
            
            // If no new responses, show a status message
            if (newMessages.length === 0) {
              newMessages.push({
                role: 'assistant',
                content: '✅ Message saved. Waiting for your next input.\n\n💡 Next speaker: ' + (data.nextSpeaker || 'You')
              });
            } else {
              // Add status about next speaker
              newMessages.push({
                role: 'assistant',
                content: `\n---\n📊 Discussion Status:\nNext speaker: ${data.nextSpeaker || 'You'}\nProject UUID: ${projectId.substring(0, 8)}...`
              });
            }
            
            return [...withoutProcessing, ...newMessages];
          });

          console.log("✅ Discussion updated");
          console.log("   Next speaker:", data.nextSpeaker || 'None');
          console.log("   Total entries:", data.entries?.length || 0);
        } else {
          console.error("❌ Discussion API error:", data.message);
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: `❌ Error: ${data.message}` }
          ]);
        }
        return;
      } catch (err: any) {
        console.error("❌ Failed to call discussion API:", err);
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: `❌ System Error: ${err.message}\n\nPlease check the console for details.` }
        ]);
        return;
      }
    }

    // Legacy flow for when projectId is not set
    let currentAgent = activeLeader;

    if (cmd.toLowerCase().includes('session') && !activeLeader) {
      const { data: leader } = await supabase
        .from('agent_templates')
        .select('*')
        .eq('code_name', 'DISC_LEADER_a1db0818-1eb5-48d3-adb9-2efb01c74d36')
        .single();

      if (leader) {
        const leaderData = leader as any;
        currentAgent = leaderData;
        setActiveLeader(leaderData);
        setRound(1);
        setMessages(prev => [...prev, { role: 'assistant', content: `Summoning Discussion Leader... (Round 1/3)` }]);
        return; 
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cmd,
          agentId: currentAgent?.id,
          history: messages.slice(-10),
          projectId: projectId
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (activeLeader) {
        const config = (activeLeader as any).ai_model_config || {};
        const maxRounds = config.max_rounds || 3;
        const isLast = round >= maxRounds;
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.text + (isLast ? '\n\n>>> SESSION COMPLETE.' : '') 
        }]);

        if (isLast) { setActiveLeader(null); setRound(0); } else { setRound(prev => prev + 1); }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `System Error: ${err.message}` }]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e]">
      {/* Header */}
      <div className="px-10 py-6 border-b border-gray-800 flex justify-between bg-gray-950 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className={`h-3 w-3 rounded-full ${activeLeader ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">
            {activeLeader ? `${(activeLeader as any).name} | ROUND ${round}/3` : 'MANAGER_ALPHA_READY'}
          </span>
        </div>
        {projectId && (
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-[0.3em] text-gray-500">Project</span>
            <span className="text-[10px] font-mono text-gray-400">{projectId.slice(0, 8)}...</span>
          </div>
        )}
      </div>

      {/* Chat Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6 bg-[#2f2f2f] chat-scroll">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-5 duration-300`}>
            <div className={`${msg.role === 'user' ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[80%]'}`}>
              <div className={`p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-blue-900/30 border border-blue-500/30 text-gray-100' 
                  : activeLeader 
                  ? 'bg-gray-800/70 text-orange-400 border-l-4 border-orange-500' 
                  : 'bg-gray-800/50 text-gray-100'
              }`}>
                <p className="text-base md:text-lg leading-relaxed whitespace-pre-line">{msg.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gray-950 border-t border-gray-800 p-4 md:p-6">
        <form onSubmit={handleAction} className="max-w-5xl mx-auto relative">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={activeLeader ? "Contribute..." : "Master command..."} 
            aria-label="Chat message input"
            className="w-full bg-gray-800 border border-gray-700 rounded-3xl px-6 py-4 text-base md:text-lg text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          <button 
            type="submit"
            aria-label="Send message"
            className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
          >
            <span className="text-xl">🚀</span>
          </button>
        </form>
      </div>
    </div>
  );
}

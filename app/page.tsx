'use client';
import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import AgentList from '../components/AgentList';
import ManagerChat from '../components/ManagerChat';

export default function App() {
  // Wir starten jetzt standardmäßig im Manager-Chat
  const [activePage, setActivePage] = useState('manager');

  return (
    <DashboardLayout activePage={activePage} setActivePage={setActivePage}>
      <div className="h-full w-full">
        {activePage === 'manager' && <ManagerChat />}
        {activePage === 'agents' && <AgentList />}
        {activePage === 'dashboard' && (
          <div className="p-20 flex items-center justify-center h-full bg-slate-50">
             <div className="text-center">
                <h1 className="text-7xl font-black italic tracking-tighter uppercase text-slate-200">System</h1>
                <p className="text-slate-400 mt-4 text-xl font-mono uppercase tracking-[0.3em]">Kern-Integrität: 100%</p>
             </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


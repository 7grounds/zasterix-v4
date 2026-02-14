'use client';
import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import AgentList from '@/components/AgentList';
import ProjectHistory from '@/components/ProjectHistory';

export default function App() {
  const [activePage, setActivePage] = useState('agents');

  return (
    <DashboardLayout activePage={activePage} setActivePage={setActivePage}>
      <div className="animate-in fade-in duration-500">
        {activePage === 'agents' && <AgentList />}
        {activePage === 'history' && <ProjectHistory />}
        {activePage === 'dashboard' && (
          <div className="p-10">
            <h1 className="text-3xl font-bold">Origo Command Center</h1>
            <p className="mt-4 text-gray-500 italic">System bereit. Wähle ein Modul.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

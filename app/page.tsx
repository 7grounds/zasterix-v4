'use client';
import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import AgentList from '@/components/AgentList';
import ProjectHistory from '@/components/ProjectHistory';

export default function IndexPage() {
  // Wir setzen 'agents' als Standard, damit die Seite beim Laden nicht leer ist
  const [activePage, setActivePage] = useState('agents');

  return (
    <DashboardLayout activePage={activePage} setActivePage={setActivePage}>
      <div className="max-w-7xl mx-auto">
        {activePage === 'agents' && <AgentList />}
        {activePage === 'history' && <ProjectHistory />}
        {activePage === 'dashboard' && (
          <div className="p-10">
            <h1 className="text-3xl font-bold text-slate-900">Origo Dashboard</h1>
            <p className="mt-4 text-slate-500">Willkommen in deiner KI-Zentrale.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

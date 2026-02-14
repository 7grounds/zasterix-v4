/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
}

export default function DashboardLayout({ children, activePage, setActivePage }: LayoutProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Home', icon: '🏠' },
    { id: 'agents', label: 'Agenten', icon: '👥' },
    { id: 'history', label: 'History', icon: '📜' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#fcfcfd] font-sans text-slate-900">
      {/* Sidebar / Topbar Mobile */}
      <aside className="w-full md:w-64 bg-slate-950 text-white flex flex-col shadow-2xl z-50">
        <div className="p-6 md:p-8 flex flex-row md:flex-col justify-between items-center md:items-start">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-black italic text-xs">O</div>
            <h1 className="text-xl font-black tracking-tighter italic">ORIGO V4</h1>
          </div>
          <p className="hidden md:block text-[9px] text-blue-400 font-mono font-bold tracking-[0.2em] mt-3">OPERATIONAL</p>
        </div>
        
        <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible px-4 pb-4 md:pb-0">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex items-center space-x-3 px-4 py-3 mr-2 md:mr-0 md:mb-2 rounded-xl transition-all whitespace-nowrap ${
                activePage === item.id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs md:text-sm font-bold tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1">
        <div className="h-full w-full max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

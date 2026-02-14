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
    { id: 'manager', label: 'Manager Alpha', icon: '👑' },
    { id: 'agents', label: 'Agenten-Schwarm', icon: '👥' },
    { id: 'history', label: 'History', icon: '📜' },
    { id: 'dashboard', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#fcfcfd] font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-slate-950 text-white flex flex-col shadow-2xl z-50">
        <div className="p-8">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black italic shadow-lg shadow-orange-900/20 text-white">O</div>
            <h1 className="text-2xl font-black tracking-tighter italic">ORIGO V4</h1>
          </div>
          <div className="mt-4 flex items-center space-x-2 border-l-2 border-orange-600 pl-3">
            <div className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-pulse"></div>
            <p className="text-[9px] text-slate-500 font-mono font-bold tracking-[0.2em] uppercase">Manager_Connected</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 ${
                activePage === item.id 
                  ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/30 translate-x-1' 
                  : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm font-bold tracking-tight uppercase italic">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-900">
           <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <p className="text-[10px] text-slate-500 font-mono uppercase">Node_Status</p>
              <p className="text-xs font-bold text-orange-500 italic">Discussion Leader Aktiv</p>
           </div>
        </div>
      </aside>
      
      {/* Main Area: Keine Scrollbalken hier, da der Chat intern scrollt */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden bg-white">
        {children}
      </main>
    </div>
  );
}

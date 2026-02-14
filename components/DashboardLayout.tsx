'use client';
import React, { ReactNode } from 'react';

// Definition der Props für TypeScript
interface LayoutProps {
  children: ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
}

export default function DashboardLayout({ children, activePage, setActivePage }: LayoutProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'agents', label: 'Agenten', icon: '👥' },
    { id: 'history', label: 'History', icon: '📜' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-6 shadow-xl">
        <div className="mb-10 px-2">
          <h1 className="text-2xl font-black tracking-tighter italic text-white">ORIGO V4</h1>
          <p className="text-[10px] text-blue-400 font-mono font-bold tracking-widest">STATUS: OPERATIONAL</p>
        </div>
        <nav>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 mb-2 rounded-lg transition-all duration-200 ${
                activePage === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-semibold tracking-wide">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

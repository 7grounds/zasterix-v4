'use client';
import React from 'react';

export default function DashboardLayout({ children, activePage, setActivePage }: any) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'agents', label: 'Agenten', icon: '👥' },
    { id: 'history', label: 'History', icon: '📜' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-6">
        <div className="mb-10 px-2">
          <h1 className="text-2xl font-black tracking-tighter italic">ORIGO V4</h1>
          <p className="text-[10px] text-slate-500 font-mono">STATUS: OPERATIONAL</p>
        </div>
        <nav>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 mb-2 rounded-lg transition-all ${
                activePage === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

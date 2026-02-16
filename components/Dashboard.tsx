'use client';
import React from 'react';
import ManagerChat from './ManagerChat';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Dashboard Header with Logout */}
      <div className="px-10 py-4 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black italic shadow-lg shadow-orange-900/20 text-white">
            O
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter italic text-slate-900">
              ORIGO V4
            </h1>
            <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">
              Dashboard
            </p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-sm"
        >
          Logout
        </button>
      </div>

      {/* Manager Chat Component */}
      <div className="flex-1 overflow-hidden">
        <ManagerChat />
      </div>
    </div>
  );
}

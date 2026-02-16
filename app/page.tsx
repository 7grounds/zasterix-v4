'use client';
import { useState, useEffect } from 'react';
import LoginForm from '../components/LoginForm';
import Dashboard from '../components/Dashboard';
import { getAuthState, setAuthState, clearAuthState } from '../lib/auth';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication state on mount
  useEffect(() => {
    const authState = getAuthState();
    setIsAuthenticated(authState);
    setIsLoading(false);
  }, []);

  const handleLogin = () => {
    setAuthState(true);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuthState();
    setIsAuthenticated(false);
  };

  // Show loading state briefly
  if (isLoading) {
    return (
      <main className="h-screen w-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl shadow-xl shadow-orange-900/20 mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl font-black italic text-white">O</span>
          </div>
          <p className="text-sm text-slate-500 font-mono uppercase tracking-wider">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-full bg-white overflow-hidden">
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </main>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '../components/LoginForm';
import { getAuthState, setAuthState } from '../lib/auth';

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check authentication state on mount and redirect if authenticated
  useEffect(() => {
    const authState = getAuthState();
    if (authState) {
      // User is already logged in, redirect to dashboard
      router.push('/dashboard');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogin = () => {
    setAuthState(true);
    // Redirect to dashboard after successful login
    router.push('/dashboard');
  };

  // Show loading state briefly while checking auth
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
      <LoginForm onLogin={handleLogin} />
    </main>
  );
}

'use client';
import React, { useState } from 'react';
import { isValidEmail, validateCredentials } from '../lib/auth';

interface LoginFormProps {
  onLogin: () => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate email format
    if (!email.trim()) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    // Validate password
    if (!password) {
      setError('Password is required');
      setIsLoading(false);
      return;
    }

    // Small delay for better UX (prevents jarring instant transitions)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Validate credentials
    if (validateCredentials(email, password)) {
      onLogin();
    } else {
      setError('Invalid email or password');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-md px-8">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-600 rounded-2xl shadow-xl shadow-orange-900/20 mb-6">
            <span className="text-3xl font-black italic text-white">O</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic text-slate-900 mb-2">
            ORIGO V4
          </h1>
          <p className="text-sm text-slate-500 uppercase tracking-[0.3em] font-mono">
            Command Center
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed text-slate-900"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed text-slate-900"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-orange-900/20 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">
              System Ready
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

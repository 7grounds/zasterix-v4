// Simple authentication utilities
// Note: These credentials are hardcoded per requirements for a simple demo.
// In production, use proper authentication with environment variables and secure password hashing.
export const VALID_CREDENTIALS = {
  email: process.env.NEXT_PUBLIC_AUTH_EMAIL || '7grounds@gmail.com',
  password: process.env.NEXT_PUBLIC_AUTH_PASSWORD || 'aaa', // Weak password per requirements
};

export const validateCredentials = (email: string, password: string): boolean => {
  return email === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password;
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Session storage keys
export const AUTH_STORAGE_KEY = 'zasterix_auth_state';

export const setAuthState = (isAuthenticated: boolean): void => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ isAuthenticated }));
  }
};

export const getAuthState = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const { isAuthenticated } = JSON.parse(stored);
        return isAuthenticated === true;
      } catch {
        return false;
      }
    }
  }
  return false;
};

export const clearAuthState = (): void => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
};

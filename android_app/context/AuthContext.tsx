import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, getUser, setAuth, clearAuth, User } from '../lib/auth';
import { authApi } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setCurrentUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, u] = await Promise.all([getToken(), getUser()]);
      setToken(t);
      setUserState(u);
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await setAuth(res.token, res.user);
    setToken(res.token);
    setUserState(res.user);
  };

  const logout = async () => {
    await clearAuth();
    setToken(null);
    setUserState(null);
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.me();
      if (res?.user) {
        setUserState(res.user);
        const t = await getToken();
        if (t) await setAuth(t, res.user);
      }
    } catch { /* ignore */ }
  };

  const setCurrentUser = (u: User) => setUserState(u);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

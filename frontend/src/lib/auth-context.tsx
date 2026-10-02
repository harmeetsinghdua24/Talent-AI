"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, setToken, setStoredRole, getStoredRole, UserOut, UserRole } from "./api";

interface AuthContextValue {
  user: UserOut | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserRole>;
  register: (payload: { email: string; password: string; full_name: string; role: UserRole; company_name?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [role, setRole] = useState<UserRole | null>(() => getStoredRole() as UserRole | null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadMe = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      setRole(me.role);
    } catch {
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial session load on mount is the correct pattern here
    loadMe();
  }, [loadMe]);

  const login = async (email: string, password: string) => {
    const { access_token, role: userRole } = await api.login({ email, password });
    setToken(access_token);
    setStoredRole(userRole);
    setRole(userRole);
    await loadMe();
    return userRole;
  };

  const register = async (payload: { email: string; password: string; full_name: string; role: UserRole; company_name?: string }) => {
    await api.register(payload);
    await login(payload.email, payload.password);
  };

const logout = () => {
  setToken(null);
  setStoredRole(null);
  setUser(null);
  setRole(null);

  window.location.href = "/";
};

  return (
    <AuthContext.Provider value={{ user, role, loading, login, register, logout, refreshUser: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

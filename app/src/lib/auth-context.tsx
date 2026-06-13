"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User, EmployerProfile, WorkerProfile } from "./types";
import type { UserRole } from "./constants";
import { roleHomePath } from "./auth-routes";

interface AuthState {
  token: string | null;
  user: User | null;
  profile: EmployerProfile | WorkerProfile | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User, profile: EmployerProfile | WorkerProfile | null) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "joby_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    profile: null,
    isLoading: true,
  });

  const fetchMe = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        setState({ token: null, user: null, profile: null, isLoading: false });
        return;
      }
      const data = await res.json();
      setState({
        token,
        user: data.user,
        profile: data.profile,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setState({ token: null, user: null, profile: null, isLoading: false });
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      fetchMe(stored);
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [fetchMe]);

  const login = useCallback(
    (token: string, user: User, profile: EmployerProfile | WorkerProfile | null) => {
      localStorage.setItem(TOKEN_KEY, token);
      setState({ token, user, profile, isLoading: false });
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ token: null, user: null, profile: null, isLoading: false });
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) await fetchMe(token);
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRequireAuth(requiredRole?: UserRole) {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      const loginPath =
        requiredRole === "worker" || requiredRole === "employer"
          ? `/login/${requiredRole}`
          : "/login";
      window.location.href = loginPath;
    }
    if (
      !auth.isLoading &&
      auth.user &&
      requiredRole &&
      auth.user.role !== requiredRole
    ) {
      window.location.href = `${roleHomePath(auth.user.role)}?notice=role_mismatch`;
    }
  }, [auth.isLoading, auth.user, requiredRole]);

  return auth;
}

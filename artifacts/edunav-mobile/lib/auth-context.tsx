import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiGet, apiRequest, setSessionCookie } from "./api";
import { DEMO_USER, isDemoMode, persistDemoFlag } from "./demo-data";

export type User = {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin?: boolean;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (input: {
    username: string;
    password: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Demo mode: persist the URL flag (so SPA navigations stay in demo) and
    // skip the network entirely — go straight to the synthetic demo user.
    persistDemoFlag();
    if (isDemoMode()) {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }
    try {
      const u = await apiGet<User>("/api/auth/user", {
        allowUnauthorized: true,
      });
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const u = await apiRequest<User>("POST", "/api/login", {
        username,
        password,
      });
      setUser(u);
    },
    [],
  );

  const signUp = useCallback(
    async (input: {
      username: string;
      password: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const u = await apiRequest<User>("POST", "/api/register", input);
      setUser(u);
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/logout");
    } catch {
      // ignore
    }
    await setSessionCookie(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signUp, signOut, refresh }),
    [user, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

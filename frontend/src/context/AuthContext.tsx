import React, { createContext, useContext, useMemo, useState } from "react";
import type { AuthUser } from "../types/auth";

const AUTH_STORAGE_KEY = "auth";

type StoredAuth = {
  token: string | null;
  user: AuthUser | null;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  role: AuthUser["role"] | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const readStoredAuth = (): StoredAuth => {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!stored) {
    return { token: null, user: null };
  }

  try {
    return JSON.parse(stored) as StoredAuth;
  } catch {
    return { token: null, user: null };
  }
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [auth, setAuth] = useState<StoredAuth>(() => readStoredAuth());

  const login = (token: string, user: AuthUser) => {
    const nextAuth = { token, user };
    setAuth(nextAuth);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  };

  const logout = () => {
    setAuth({ token: null, user: null });
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      user: auth.user,
      token: auth.token,
      role: auth.user?.role ?? null,
      isAuthenticated: Boolean(auth.token),
      login,
      logout,
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

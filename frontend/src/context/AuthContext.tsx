// src/context/AuthContext.tsx
import React, { createContext, useState, useContext } from "react";

type AuthContextType = {
  user: string | null;
  role: string | null;
  token: string | null;
  login: (user: string, role: string, token: string) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [auth, setAuth] = useState<{
    user: string | null;
    role: string | null;
    token: string | null;
  }>({
    user: localStorage.getItem("user"),
    role: localStorage.getItem("role"),
    token: localStorage.getItem("token"),
  });

  const login = (user: string, role: string, token: string) => {
    setAuth({ user, role, token });
    localStorage.setItem("user", user);
    localStorage.setItem("role", role);
    localStorage.setItem("token", token);
  };

  const logout = () => {
    setAuth({ user: null, role: null, token: null });
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentUser } from "../api/authApi";
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
  isInitializing: boolean;
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
  const initialAuthRef = useRef<StoredAuth>(readStoredAuth());
  const [auth, setAuth] = useState<StoredAuth>(initialAuthRef.current);
  const [isInitializing, setIsInitializing] = useState(
    Boolean(initialAuthRef.current.token)
  );

  const persistAuth = (nextAuth: StoredAuth) => {
    setAuth(nextAuth);

    if (nextAuth.token) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
      return;
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const login = (token: string, user: AuthUser) => {
    persistAuth({ token, user });
  };

  const logout = () => {
    persistAuth({ token: null, user: null });
  };

  useEffect(() => {
    let isCancelled = false;

    const validateStoredSession = async () => {
      if (!auth.token) {
        setIsInitializing(false);
        return;
      }

      setIsInitializing(true);

      try {
        const response = await getCurrentUser();

        if (isCancelled) {
          return;
        }

        persistAuth({ token: auth.token, user: response.data.user });
      } catch {
        if (isCancelled) {
          return;
        }

        persistAuth({ token: null, user: null });
      } finally {
        if (!isCancelled) {
          setIsInitializing(false);
        }
      }
    };

    void validateStoredSession();

    return () => {
      isCancelled = true;
    };
  }, [auth.token]);

  const value = useMemo(
    () => ({
      user: auth.user,
      token: auth.token,
      role: auth.user?.role ?? null,
      isAuthenticated: Boolean(auth.token),
      isInitializing,
      login,
      logout,
    }),
    [auth, isInitializing]
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

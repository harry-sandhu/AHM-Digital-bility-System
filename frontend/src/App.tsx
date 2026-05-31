import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import type { Role } from "./types/auth";
import LoginPage from "./Pages/LoginPage";
import SignupPage from "./Pages/SignupPage";
import HomePage from "./Pages/HomePage";
import BiltyPage from "./Pages/BiltyPage";
import UsersPage from "./Pages/UsersPage";
import CreateAdminPage from "./Pages/CreateAdminPage";
import BiltyTermsPage from "./Pages/BiltyTermsPage";

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: Role[];
}> = ({ children, allowedRoles }) => {
  const { token, role } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { token, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-sm text-slate-600">
        Checking your saved session...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={!token ? <LoginPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/signup"
        element={!token ? <SignupPage /> : <Navigate to="/" replace />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bilty/terms"
        element={
          <ProtectedRoute>
            <BiltyTermsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bilty"
        element={
          <ProtectedRoute>
            <BiltyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admins/new"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <CreateAdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to={token ? "/" : "/login"} replace />}
      />
    </Routes>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <AppRoutes />
    </Router>
  </AuthProvider>
);

export default App;

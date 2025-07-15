import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./Pages/LoginPage";
import Signup from "./Pages/SignupPage";
import HomePage from "./Pages/HomePage";
import BiltyPage from "./Pages/BiltyPage";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { token } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={!token ? <LoginPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/signup"
        element={!token ? <Signup /> : <Navigate to="/" replace />}
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
        path="/bilty"
        element={
          <ProtectedRoute>
            <BiltyPage />
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

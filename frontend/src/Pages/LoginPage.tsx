import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/authApi";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await loginApi({ phone, password });
      login(response.data.token, response.data.user);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in with your registered phone number to manage bilty creation, user access, and transport records."
    >
      <form onSubmit={handleSubmit} className="card p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Secure Login
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Access your dashboard</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Super admins, admins, and users log in here using phone and password.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="Enter your phone number"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter your password"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-semibold text-blue-600 hover:underline">
            Create a user account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default LoginPage;

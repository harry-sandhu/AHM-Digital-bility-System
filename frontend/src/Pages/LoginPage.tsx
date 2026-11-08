import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login as loginApi } from "../api/authApi";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../utils/apiError";
import { normalizePhone } from "../utils/phone";

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { showError } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await loginApi({
        phone: normalizePhone(phone),
        password,
      });
      login(response.data.token, response.data.user);
      navigate("/");
    } catch (err) {
      showError(getApiErrorMessage(err, "Login failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in with your registered phone number to manage bilty creation, user access, and transport records. Use digits only, for example 9999999999."
    >
      <form onSubmit={handleSubmit} className="card p-8">
        <div>
          <p className="inline-flex rounded-pill bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Secure Login
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Access your dashboard</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Super admins, admins, and users log in here using phone and password.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
              value={phone}
              onChange={(e) => setPhone(normalizePhone(e.target.value))}
              className="input"
              placeholder="Enter your phone number"
              required
            />
            <p className="mt-2 text-xs text-slate-500">Enter digits only, without spaces or symbols.</p>
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
          className="mt-6 w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
            Create a user account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default LoginPage;

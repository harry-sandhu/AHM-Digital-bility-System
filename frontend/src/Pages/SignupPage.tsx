import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/authApi";
import AuthShell from "../components/AuthShell";

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await register({ name, phone, password });
      setSuccess("Account created successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 900);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your user account"
      subtitle="Users can register themselves, agree to the terms before bilty generation, and download the bilty with attached terms & conditions."
    >
      <form onSubmit={handleSubmit} className="card p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-600">
            User Registration
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Sign up to get started</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your account will be created as a normal user. Admin accounts are created only by the super admin.
          </p>
        </div>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
          />
          <input
            type="text"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-blue-600 hover:underline">
            Login here
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default SignupPage;

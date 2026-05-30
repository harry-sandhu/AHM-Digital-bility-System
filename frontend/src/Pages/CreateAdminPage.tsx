import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { createAdminAccount } from "../api/usersApi";

const CreateAdminPage: React.FC = () => {
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
      await createAdminAccount({ name, phone, password });
      setSuccess("Admin created successfully.");
      setName("");
      setPhone("");
      setPassword("");
      setTimeout(() => navigate("/users"), 900);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to create admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7,white_45%,#fffbeb_100%)]">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600">
              Super Admin Only
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">Create a new admin account</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Admins can monitor users, access all bilty records, and support day-to-day operations. Normal users still register on their own through the signup page.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="font-semibold text-slate-900">What this admin will be able to do</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>• View all users</li>
                  <li>• View all bilty records</li>
                  <li>• Manage bilty operations</li>
                </ul>
              </div>
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                Admins cannot create other admins and cannot disable users.
              </div>
            </div>
          </section>

          <form onSubmit={handleSubmit} className="card p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-slate-900">Admin details</h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter the name, phone number, and password for the new admin.
            </p>

            {error ? (
              <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </p>
            ) : null}

            <div className="mt-6 space-y-4">
              <input
                type="text"
                placeholder="Admin name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
              />
              <input
                type="text"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {isSubmitting ? "Creating admin..." : "Create Admin"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateAdminPage;

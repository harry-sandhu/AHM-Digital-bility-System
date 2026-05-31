import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { disableUserAccount, getAllUsers } from "../api/usersApi";
import { useAuth } from "../context/AuthContext";
import type { UserRecord } from "../types/user";
import { getApiErrorMessage } from "../utils/apiError";

const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getAllUsers();
      setUsers(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleDisable = async (id: string) => {
    setActionMessage("");
    setError("");

    try {
      await disableUserAccount(id);
      setActionMessage("User disabled successfully.");
      await loadUsers();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to disable user"));
    }
  };

  const stats = useMemo(() => {
    const active = users.filter((item) => item.isActive).length;
    const disabled = users.length - active;
    const admins = users.filter((item) => item.role === "admin").length;
    const normalUsers = users.filter((item) => item.role === "user").length;

    return { active, disabled, admins, normalUsers };
  }, [users]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ede9fe,white_45%,#eef2ff_100%)]">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-600">
                User Management
              </p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">All users</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Admins and super admins can view all users. Only super admin can disable normal users.
              </p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-700">
              Logged in as <span className="font-semibold capitalize">{user?.role}</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { label: "Total Users", value: users.length },
              { label: "Active", value: stats.active },
              { label: "Disabled", value: stats.disabled },
              { label: "Admins", value: stats.admins },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card mt-8 p-6">
          {actionMessage ? (
            <p className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {actionMessage}
            </p>
          ) : null}
          {error ? (
            <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-slate-500">Loading users...</p>
          ) : (
            <div className="overflow-x-auto rounded-[24px] border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Name</th>
                    <th className="px-5 py-4 font-semibold">Phone</th>
                    <th className="px-5 py-4 font-semibold">Role</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {users.map((item) => {
                    const id = item._id || item.id || "";
                    const canDisable =
                      user?.role === "superadmin" &&
                      item.role === "user" &&
                      item.isActive;

                    return (
                      <tr key={id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-medium text-slate-900">{item.name}</td>
                        <td className="px-5 py-4 text-slate-600">{item.phone}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                            {item.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {canDisable ? (
                            <button
                              onClick={() => handleDisable(id)}
                              className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                            >
                              Disable User
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default UsersPage;

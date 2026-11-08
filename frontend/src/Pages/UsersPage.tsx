import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { disableUserAccount, getAllUsers } from "../api/usersApi";
import { assignUserToGroup, createGroup, getAllGroups } from "../api/groupsApi";
import type { Group } from "../api/groupsApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import type { UserRecord } from "../types/user";
import { getApiErrorMessage } from "../utils/apiError";

const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const isSuperadmin = user?.role === "superadmin";

  const loadUsers = async () => {
    setLoading(true);

    try {
      const response = await getAllUsers();
      setUsers(response.data);
    } catch (err) {
      showError(getApiErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await getAllGroups();
      setGroups(response.data);
    } catch (err) {
      showError(getApiErrorMessage(err, "Failed to load groups"));
    }
  };

  useEffect(() => {
    void loadUsers();
    if (isSuperadmin) {
      void loadGroups();
    }
  }, [isSuperadmin]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      return;
    }

    setIsCreatingGroup(true);

    try {
      await createGroup(trimmedName);
      setNewGroupName("");
      showSuccess("Group created.");
      await loadGroups();
    } catch (err) {
      showError(getApiErrorMessage(err, "Failed to create group"));
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleAssignGroup = async (userId: string, groupId: string) => {
    if (!groupId) {
      return;
    }

    try {
      await assignUserToGroup(groupId, userId);
      showSuccess("User assigned to group — their saved contacts have been merged into it.");
      await loadUsers();
    } catch (err) {
      showError(getApiErrorMessage(err, "Failed to assign user to group"));
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await disableUserAccount(id);
      showSuccess("User disabled successfully.");
      await loadUsers();
    } catch (err) {
      showError(getApiErrorMessage(err, "Failed to disable user"));
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
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex rounded-pill bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                User Management
              </p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">All users</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Admins and super admins can view all users. Only super admin can disable normal users.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
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
              <div key={item.label} className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {isSuperadmin ? (
          <section className="card mt-8 p-6">
            <h2 className="text-lg font-bold text-slate-900">Shared contact groups</h2>
            <p className="mt-1 text-sm text-slate-600">
              Users in the same group share one consignor/consignee saved-contacts list. Assigning
              a user to a group merges their existing saved contacts into it.
            </p>
            <form onSubmit={handleCreateGroup} className="mt-4 flex flex-wrap gap-3">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name"
                className="input max-w-xs"
              />
              <button
                type="submit"
                disabled={isCreatingGroup || !newGroupName.trim()}
                className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              >
                {isCreatingGroup ? "Creating..." : "Create Group"}
              </button>
            </form>
            {groups.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {group.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="card mt-8 p-6">
          {loading ? (
            <p className="text-slate-500">Loading users...</p>
          ) : (
            <>
              {/* Desktop table — a mobile viewport can't reach columns past
                  Role with no visible scroll affordance, so narrow screens
                  get the stacked-card layout below instead. */}
              <div className="hidden overflow-x-auto rounded-card border border-slate-200 lg:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Name</th>
                      <th className="px-5 py-4 font-semibold">Phone</th>
                      <th className="px-5 py-4 font-semibold">Role</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      {isSuperadmin ? <th className="px-5 py-4 font-semibold">Group</th> : null}
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
                                  ? "bg-success-100 text-success-700"
                                  : "bg-danger-100 text-danger-700"
                              }`}
                            >
                              {item.isActive ? "Active" : "Disabled"}
                            </span>
                          </td>
                          {isSuperadmin ? (
                            <td className="px-5 py-4">
                              <select
                                value={item.groupId || ""}
                                onChange={(e) => handleAssignGroup(id, e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                              >
                                <option value="">No group</option>
                                {groups.map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {group.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          ) : null}
                          <td className="px-5 py-4">
                            {canDisable ? (
                              <button
                                onClick={() => handleDisable(id)}
                                className="rounded-full bg-danger-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-danger-700"
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

              <div className="space-y-4 lg:hidden">
                {users.map((item) => {
                  const id = item._id || item.id || "";
                  const canDisable =
                    user?.role === "superadmin" &&
                    item.role === "user" &&
                    item.isActive;

                  return (
                    <div key={id} className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.phone}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.isActive
                              ? "bg-success-100 text-success-700"
                              : "bg-danger-100 text-danger-700"
                          }`}
                        >
                          {item.isActive ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        {item.role}
                      </span>
                      {isSuperadmin ? (
                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-medium text-slate-500">Group</label>
                          <select
                            value={item.groupId || ""}
                            onChange={(e) => handleAssignGroup(id, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700"
                          >
                            <option value="">No group</option>
                            {groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      {canDisable ? (
                        <button
                          onClick={() => handleDisable(id)}
                          className="mt-3 w-full rounded-full bg-danger-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-danger-700"
                        >
                          Disable User
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default UsersPage;

import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { getAllBilties } from "../api/biltyApi";
import { getAllUsers } from "../api/usersApi";
import {
  createRange,
  deleteRange,
  getRanges,
  updateRange,
} from "../api/numberRangesApi";
import { getApiErrorMessage } from "../utils/apiError";
import type { UserRecord } from "../types/user";
import type { NumberRange, NumberRangeScope } from "../types/numberRange";

const SuperadminDashboardPage: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [biltiesCount, setBiltiesCount] = useState(0);
  const [ranges, setRanges] = useState<NumberRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<NumberRangeScope>("master");
  const [userId, setUserId] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [editingRangeId, setEditingRangeId] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const [usersResponse, biltiesResponse, rangesResponse] = await Promise.all([
        getAllUsers(),
        getAllBilties(),
        getRanges(),
      ]);

      setUsers(usersResponse.data);
      setBiltiesCount(biltiesResponse.data.length);
      setRanges(rangesResponse.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load superadmin dashboard"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const stats = useMemo(
    () => ({
      activeRanges: ranges.filter((range) => range.isActive && !range.isExhausted).length,
      exhaustedRanges: ranges.filter((range) => range.isExhausted).length,
    }),
    [ranges]
  );

  const resetForm = () => {
    setLabel("");
    setScope("master");
    setUserId("");
    setRangeStart("");
    setRangeEnd("");
    setEditingRangeId(null);
    setShowForm(false);
  };

  const handleEdit = (range: NumberRange) => {
    setEditingRangeId(range._id);
    setLabel(range.label || "");
    setScope(range.scope);
    setUserId(
      range.userId && typeof range.userId !== "string" ? range.userId._id : range.userId || ""
    );
    setRangeStart(String(range.rangeStart));
    setRangeEnd(String(range.rangeEnd));
    setShowForm(true);
    setError("");
    setActionMessage("");
  };

  const handleDelete = async (range: NumberRange) => {
    if (range.nextNumber !== range.rangeStart) {
      setError("A range can only be deleted before it issues its first number.");
      return;
    }

    if (!window.confirm("Delete this number range?")) {
      return;
    }

    setError("");
    setActionMessage("");
    try {
      await deleteRange(range._id);
      setActionMessage("Number range deleted.");
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to delete number range"));
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setActionMessage("");

    const start = Number(rangeStart);
    const end = Number(rangeEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1000 || end < start) {
      setError("Enter valid integer range values. Start must be at least 1000.");
      return;
    }

    if (scope === "personal" && !userId) {
      setError("Select a user for a personal range.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingRangeId) {
        await updateRange(editingRangeId, {
          label: label.trim() || undefined,
          userId: scope === "personal" ? userId : undefined,
          rangeEnd: end,
        });
        setActionMessage("Number range updated successfully.");
      } else {
        await createRange({
          label: label.trim() || undefined,
          scope,
          userId: scope === "personal" ? userId : undefined,
          rangeStart: start,
          rangeEnd: end,
        });
        setActionMessage("Number range created successfully.");
      }
      resetForm();
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create number range"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (range: NumberRange) => {
    setError("");
    setActionMessage("");
    try {
      await updateRange(range._id, { isActive: false });
      setActionMessage("Number range deactivated.");
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to deactivate number range"));
    }
  };

  const getUserLabel = (range: NumberRange) => {
    if (!range.userId || typeof range.userId === "string") {
      return range.scope === "master" ? "All users" : "—";
    }
    return `${range.userId.name} (${range.userId.phone})`;
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7,white_45%,#fffbeb_100%)]">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600">
            Super Admin Dashboard
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Consignment number pools</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Configure globally unique master and user-specific consignment number ranges.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm((value) => !value)}
              className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-700"
            >
              + New Range
            </button>
          </div>

          {error ? (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          {actionMessage ? (
            <p className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {actionMessage}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total Users", users.length],
              ["Bilties Created", biltiesCount],
              ["Active Ranges", stats.activeRanges],
              ["Exhausted Ranges", stats.exhaustedRanges],
            ].map(([title, value]) => (
              <div key={title} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {showForm ? (
          <form onSubmit={handleCreate} className="card mt-8 p-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {editingRangeId ? "Edit number range" : "Create number range"}
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input className="input" placeholder="Label (optional)" value={label} onChange={(event) => setLabel(event.target.value)} />
              <select className="input" value={scope} disabled={Boolean(editingRangeId)} onChange={(event) => setScope(event.target.value as NumberRangeScope)}>
                <option value="master">Master</option>
                <option value="personal">Personal</option>
              </select>
              {scope === "personal" ? (
                <select className="input" value={userId} onChange={(event) => setUserId(event.target.value)} required>
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user._id || user.id} value={user._id || user.id}>
                      {user.name} ({user.phone})
                    </option>
                  ))}
                </select>
              ) : null}
              <input className="input" type="number" min="1000" placeholder="Range start" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} disabled={Boolean(editingRangeId)} required />
              <input className="input" type="number" min="1000" placeholder="Range end" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} required />
            </div>
            <div className="mt-5 flex gap-3">
              <button type="submit" disabled={isSaving} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {isSaving ? "Saving..." : editingRangeId ? "Save Changes" : "Create Range"}
              </button>
              <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <section className="card mt-8 p-6">
          <h2 className="text-2xl font-bold text-slate-900">Number Ranges</h2>
          {loading ? <p className="mt-5 text-slate-500">Loading ranges...</p> : (
            <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {['Label', 'Scope', 'Assigned User', 'Start–End', 'Next', 'Remaining', 'Status', 'Action'].map((heading) => <th key={heading} className="px-5 py-4 font-semibold">{heading}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ranges.map((range) => (
                    <tr key={range._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-medium text-slate-900">{range.label || "—"}</td>
                      <td className="px-5 py-4 capitalize">{range.scope}</td>
                      <td className="px-5 py-4 text-slate-600">{getUserLabel(range)}</td>
                      <td className="px-5 py-4">{range.rangeStart}–{range.rangeEnd}</td>
                      <td className="px-5 py-4">{range.nextNumber}</td>
                      <td className="px-5 py-4">{range.remaining}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${range.isExhausted ? "bg-slate-100 text-slate-600" : range.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{range.isExhausted ? "Exhausted" : range.isActive ? "Active" : "Inactive"}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleEdit(range)} className="rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-white">
                            Edit
                          </button>
                          {range.isActive ? (
                            <button type="button" onClick={() => void handleDeactivate(range)} className="rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white">
                              Deactivate
                            </button>
                          ) : null}
                          {range.nextNumber === range.rangeStart ? (
                            <button type="button" onClick={() => void handleDelete(range)} className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SuperadminDashboardPage;

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteBilty, getAllBilties, getMyBilties } from "../api/biltyApi";
import { useAuth } from "../context/AuthContext";
import type { BiltyRecord } from "../types/bilty";
import {
  normalizeBiltyFormData,
  type BiltyFormState,
} from "../types/biltyForm";
import BiltyDownloadButtons from "./BiltyDownloadButtons";

type BiltyCardProps = {
  bilty: BiltyRecord;
  role?: string;
  onDelete?: (bilty: BiltyRecord) => void;
};

const BiltyCard: React.FC<BiltyCardProps> = ({ bilty, role, onDelete }) => {
  const navigate = useNavigate();
  const normalizedFormData: BiltyFormState = normalizeBiltyFormData(bilty.formData);
  const hasDocumentData = Object.values(normalizedFormData).some((value) =>
    String(value || "").trim().length > 0
  );
  const status =
    bilty.status ||
    (bilty.expiresAt && new Date(bilty.expiresAt).getTime() < Date.now()
      ? "expired"
      : "draft");

  return (
    <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            Bilty Number
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">{bilty.biltyNumber}</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right text-xs text-slate-500">
            {bilty.createdAt ? new Date(bilty.createdAt).toLocaleString() : "No date"}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              status === "expired"
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {status === "expired" ? "Expired" : "Active"}
          </span>
          <BiltyDownloadButtons
            disabled={!hasDocumentData}
            size="sm"
          />
          {role === "superadmin" ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate(`/bilty/edit/${bilty._id}`)}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
              >
                Edit Bilty
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(bilty)}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
              >
                Delete Bilty
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
        {(role === "admin" || role === "superadmin") && bilty.createdBy ? (
          <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
            <p className="font-semibold text-slate-900">Created By</p>
            <p className="mt-1">{bilty.createdBy.name}</p>
            <p>{bilty.createdBy.phone}</p>
          </div>
        ) : null}
        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
          <p className="font-semibold text-slate-900">Delivery Address</p>
          <p className="mt-1 break-words">{bilty.formData?.deliveryAddress || "—"}</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
          <p className="font-semibold text-slate-900">Driver</p>
          <p className="mt-1">{bilty.formData?.driver || "—"}</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
          <p className="font-semibold text-slate-900">Route</p>
          <p className="mt-1">
            {bilty.formData?.from || "—"} → {bilty.formData?.to || "—"}
          </p>
        </div>
        {bilty.expiresAt ? (
          <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100 md:col-span-2">
            <p className="font-semibold text-slate-900">Deadline</p>
            <p className="mt-1">
              {new Date(bilty.expiresAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        ) : null}
      </div>

    </div>
  );
};

const BiltyList: React.FC = () => {
  const { role } = useAuth();
  const [bilties, setBilties] = useState<BiltyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "biltyAsc" | "biltyDesc" | "deadline">("newest");

  const getStatus = (bilty: BiltyRecord) =>
    bilty.expiresAt && new Date(bilty.expiresAt).getTime() < Date.now()
      ? "expired"
      : "active";

  const visibleBilties = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = bilties.filter((bilty) => {
      const status = getStatus(bilty);
      const haystack = [
        bilty.biltyNumber,
        bilty.createdBy?.name,
        bilty.createdBy?.phone,
        bilty.formData?.from,
        bilty.formData?.to,
        bilty.formData?.deliveryAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || haystack.includes(query)) &&
        (statusFilter === "all" || status === statusFilter)
      );
    });

    return filtered.sort((left, right) => {
      if (sortBy === "biltyAsc" || sortBy === "biltyDesc") {
        const result = left.biltyNumber.localeCompare(right.biltyNumber, undefined, {
          numeric: true,
        });
        return sortBy === "biltyAsc" ? result : -result;
      }

      const leftDate = new Date(
        sortBy === "deadline" ? left.expiresAt || 0 : left.createdAt || 0
      ).getTime();
      const rightDate = new Date(
        sortBy === "deadline" ? right.expiresAt || 0 : right.createdAt || 0
      ).getTime();
      return sortBy === "oldest" ? leftDate - rightDate : rightDate - leftDate;
    });
  }, [bilties, search, sortBy, statusFilter]);

  const handleDelete = async (bilty: BiltyRecord) => {
    if (!window.confirm(`Delete bilty ${bilty.biltyNumber}? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteBilty(bilty._id);
      setBilties((current) => current.filter((item) => item._id !== bilty._id));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to delete bilty");
    }
  };

  useEffect(() => {
    const fetchBilties = async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          role === "superadmin"
            ? await getAllBilties()
            : await getMyBilties();

        setBilties(response.data);
      } catch (err: any) {
        setError(err?.response?.data?.error || "Failed to load bilties");
      } finally {
        setLoading(false);
      }
    };

    void fetchBilties();
  }, [role]);

  return (
    <div className="card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Bilty Records
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {role === "superadmin" ? "All Bilties" : "My Bilties"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Each saved bilty can be downloaded as a 2-page PDF or 2 PNG images.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
          {visibleBilties.length} of {bilties.length} record{bilties.length === 1 ? "" : "s"}
        </div>
      </div>

      {role === "superadmin" ? (
        <div className="mb-5 grid gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 md:grid-cols-[1.5fr_0.75fr_0.9fr]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search bilty, user, phone, route..."
            className="input"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="input">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="input">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="biltyAsc">Bilty number A-Z</option>
            <option value="biltyDesc">Bilty number Z-A</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>
      ) : null}

      {loading ? <p className="text-slate-500">Loading bilties...</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}

      {!loading && !error && visibleBilties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-slate-500">
          No bilty records found yet.
        </div>
      ) : null}

      <div className="grid gap-4">
        {visibleBilties.map((bilty) => (
          <BiltyCard key={bilty._id} bilty={bilty} role={role || undefined} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
};

export default BiltyList;

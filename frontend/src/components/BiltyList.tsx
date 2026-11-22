import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteBilty, getAllBilties, getMyBilties } from "../api/biltyApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
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
  const [showDetails, setShowDetails] = useState(false);
  const normalizedFormData: BiltyFormState = normalizeBiltyFormData(bilty.formData);
  const hasDocumentData = Object.values(normalizedFormData).some((value) =>
    String(value || "").trim().length > 0
  );
  const status =
    bilty.status ||
    (bilty.expiresAt && new Date(bilty.expiresAt).getTime() < Date.now()
      ? "expired"
      : "draft");

  // Before printing the owner can edit; after printing, or past the
  // deadline, only a superadmin can.
  const canEdit =
    role === "superadmin" || (status !== "expired" && !bilty.printedAt);

  // Fields worth a quick glance beyond the row: who made it, where it's
  // going, and money/deadline flags. Hidden by default to keep each row to
  // one line - "Details" expands them.
  const hasDetails = Boolean(
    (role === "admin" || role === "superadmin") && bilty.createdBy
  ) ||
    bilty.formData?.deliveryAddress ||
    bilty.formData?.driver ||
    bilty.formData?.from ||
    bilty.formData?.to ||
    bilty.freightAdjustment ||
    bilty.gstChargePaid ||
    bilty.expiresAt;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[7rem]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Consignment No.
          </p>
          <p className="text-base font-bold text-slate-900">{bilty.consignmentNo ?? "—"}</p>
        </div>

        <div className="min-w-[6rem]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Bilty No.
          </p>
          <p className="text-sm text-slate-700">{bilty.biltyNumber}</p>
        </div>

        <div className="min-w-[7rem]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Date
          </p>
          <p className="text-sm text-slate-700">
            {bilty.createdAt ? new Date(bilty.createdAt).toLocaleDateString() : "—"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              status === "expired"
                ? "bg-danger-100 text-danger-700"
                : "bg-success-100 text-success-700"
            }`}
          >
            {status === "expired" ? "Expired" : "Active"}
          </span>
          {bilty.printedAt ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              Printed
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {hasDetails ? (
            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
            >
              {showDetails ? "Hide Details" : "Details"}
            </button>
          ) : null}
          <BiltyDownloadButtons disabled={!hasDocumentData} size="sm" />
          {canEdit ? (
            <button
              type="button"
              onClick={() => navigate(`/bilty/edit/${bilty._id}`)}
              className="rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-700"
            >
              Edit Bilty
            </button>
          ) : null}
          {role === "superadmin" ? (
            <button
              type="button"
              onClick={() => onDelete?.(bilty)}
              className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700"
            >
              Delete Bilty
            </button>
          ) : null}
        </div>
      </div>

      {showDetails ? (
        <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600 md:grid-cols-2">
          {(role === "admin" || role === "superadmin") && bilty.createdBy ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-900">Created By</p>
              <p>{bilty.createdBy.name} · {bilty.createdBy.phone}</p>
            </div>
          ) : null}
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-900">Delivery Address</p>
            <p className="break-words">{bilty.formData?.deliveryAddress || "—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-900">Driver</p>
            <p>{bilty.formData?.driver || "—"}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-900">Route</p>
            <p>
              {bilty.formData?.from || "—"} → {bilty.formData?.to || "—"}
            </p>
          </div>
          {bilty.freightAdjustment ? (
            <div
              className={`rounded-xl px-3 py-2 md:col-span-2 ${
                bilty.freightAdjustment > 0
                  ? "bg-amber-50 text-amber-800"
                  : "bg-success-50 text-success-700"
              }`}
            >
              <p className="text-xs font-semibold">
                {bilty.freightAdjustment > 0
                  ? `Extra ₹${bilty.freightAdjustment} for higher freight tier`
                  : `Discount ₹${Math.abs(bilty.freightAdjustment)} for lower freight tier`}
              </p>
              <p className="text-xs">
                {bilty.freightAdjustment > 0
                  ? bilty.extraPaid && bilty.extraPaid >= bilty.freightAdjustment
                    ? "Paid."
                    : "Payment pending."
                  : "Applied to your net bilty charge."}
              </p>
            </div>
          ) : null}
          {bilty.gstChargePaid ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2 md:col-span-2">
              <p className="text-xs font-semibold text-slate-900">GST charge paid</p>
              <p>
                ₹{bilty.gstChargePaid.toLocaleString("en-IN", { maximumFractionDigits: 2 })} (Transporter pays the GST: 5% of freight)
              </p>
            </div>
          ) : null}
          {bilty.expiresAt ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2 md:col-span-2">
              <p className="text-xs font-semibold text-slate-900">Deadline</p>
              <p>
                {new Date(bilty.expiresAt).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const BiltyList: React.FC = () => {
  const { role } = useAuth();
  const { showSuccess, showError } = useToast();
  const [bilties, setBilties] = useState<BiltyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
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
      showSuccess(`Bilty ${bilty.biltyNumber} deleted.`);
    } catch (err: any) {
      showError(err?.response?.data?.error || "Failed to delete bilty");
    }
  };

  useEffect(() => {
    const fetchBilties = async () => {
      setLoading(true);
      setLoadFailed(false);

      try {
        const response =
          role === "superadmin"
            ? await getAllBilties()
            : await getMyBilties();

        setBilties(response.data);
      } catch (err: any) {
        setLoadFailed(true);
        showError(err?.response?.data?.error || "Failed to load bilties");
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
          <p className="inline-flex rounded-pill bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Bilty Records
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {role === "superadmin" ? "All Bilties" : "My Bilties"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Open a saved bilty with Edit Bilty to print it again.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
          {visibleBilties.length} of {bilties.length} record{bilties.length === 1 ? "" : "s"}
        </div>
      </div>

      {role === "superadmin" ? (
        <div className="mb-5 grid gap-3 rounded-2xl border border-accent-100 bg-accent-50/60 p-4 md:grid-cols-[1.5fr_0.75fr_0.9fr]">
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

      {!loading && !loadFailed && visibleBilties.length === 0 ? (
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

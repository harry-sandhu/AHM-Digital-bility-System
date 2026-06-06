import React, { useEffect, useState } from "react";
import { getAllBilties, getMyBilties } from "../api/biltyApi";
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
};

const BiltyCard: React.FC<BiltyCardProps> = ({ bilty, role }) => {
  const normalizedFormData: BiltyFormState = normalizeBiltyFormData(bilty.formData);
  const hasDocumentData = Object.values(normalizedFormData).some((value) =>
    String(value || "").trim().length > 0
  );

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
          <BiltyDownloadButtons
            biltyNumber={bilty.biltyNumber}
            formData={normalizedFormData}
            disabled={!hasDocumentData}
            size="sm"
          />
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
      </div>
    </div>
  );
};

const BiltyList: React.FC = () => {
  const { role } = useAuth();
  const [bilties, setBilties] = useState<BiltyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBilties = async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          role === "admin" || role === "superadmin"
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
            {role === "admin" || role === "superadmin" ? "All Bilties" : "My Bilties"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Each saved bilty can be downloaded as a 2-page PDF or 2 PNG images.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
          {bilties.length} record{bilties.length === 1 ? "" : "s"}
        </div>
      </div>

      {loading ? <p className="text-slate-500">Loading bilties...</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}

      {!loading && !error && bilties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-slate-500">
          No bilty records found yet.
        </div>
      ) : null}

      <div className="grid gap-4">
        {bilties.map((bilty) => (
          <BiltyCard key={bilty._id} bilty={bilty} role={role} />
        ))}
      </div>
    </div>
  );
};

export default BiltyList;

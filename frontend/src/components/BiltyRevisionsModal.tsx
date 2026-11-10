import React, { useEffect, useState } from "react";
import { getBiltyRevisions, type BiltyRevision } from "../api/biltyApi";
import { normalizeBiltyFormData } from "../types/biltyForm";
import { getApiErrorMessage } from "../utils/apiError";
import BiltyDocument from "./BiltyDocument";

type Props = {
  biltyId: string;
  onClose: () => void;
};

/**
 * Superadmin-only view of the backed-up printed versions of a bilty. Each
 * entry is the bilty exactly as it was before a superadmin changed it.
 */
const BiltyRevisionsModal: React.FC<Props> = ({ biltyId, onClose }) => {
  const [revisions, setRevisions] = useState<BiltyRevision[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<BiltyRevision | null>(null);

  useEffect(() => {
    getBiltyRevisions(biltyId)
      .then((response) => {
        setRevisions(response.data);
        setSelected(response.data[0] ?? null);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Failed to load version history")));
  }, [biltyId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revisions-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="flex max-h-full w-full max-w-5xl flex-col rounded-card bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 id="revisions-title" className="text-lg font-bold text-slate-900">
            Version history (printed copies before changes)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 md:grid-cols-[14rem_1fr]">
          <ul className="max-h-48 overflow-y-auto md:max-h-none">
            {error ? <li className="text-sm text-danger-600">{error}</li> : null}
            {!error && revisions === null ? <li className="text-sm text-slate-500">Loading…</li> : null}
            {revisions?.length === 0 ? (
              <li className="text-sm text-slate-500">No earlier versions saved yet.</li>
            ) : null}
            {revisions?.map((revision, index) => (
              <li key={revision._id}>
                <button
                  type="button"
                  onClick={() => setSelected(revision)}
                  className={`mb-2 w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    selected?._id === revision._id
                      ? "border-brand-400 bg-brand-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="block font-semibold text-slate-800">
                    Version {revisions.length - index}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Replaced{" "}
                    {revision.replacedAt ? new Date(revision.replacedAt).toLocaleString() : "—"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    by {revision.changedByName || "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="min-h-0 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            {selected ? (
              <div className="print-bilty-page mx-auto w-[720px] max-w-none">
                <BiltyDocument formData={normalizeBiltyFormData(selected.formData)} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiltyRevisionsModal;

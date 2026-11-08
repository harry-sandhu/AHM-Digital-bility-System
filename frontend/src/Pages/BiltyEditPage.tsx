import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BiltyDocument from "../components/BiltyDocument";
import { createBilty, getBilty } from "../api/biltyApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiErrorMessage } from "../utils/apiError";
import {
  calculateBiltyTotals,
  normalizeBiltyFormData,
  type BiltyFormState,
} from "../types/biltyForm";

const BiltyEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState<BiltyFormState>(normalizeBiltyFormData());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Unlike other transient feedback, a load failure gates whether the form
  // renders at all, so it stays as page state rather than a toast alone.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!id || role !== "superadmin") {
      return;
    }

    const loadBilty = async () => {
      try {
        const response = await getBilty(id);
        setFormData({
          ...normalizeBiltyFormData(response.data.formData),
          biltyNumber: response.data.biltyNumber,
          consignmentNo: String(response.data.consignmentNo ?? ""),
        });
      } catch (err) {
        setLoadFailed(true);
        showError(getApiErrorMessage(err, "Failed to load bilty"));
      } finally {
        setLoading(false);
      }
    };

    void loadBilty();
  }, [id, role]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const name = event.target.dataset.fieldName || event.target.name;

    setFormData((current) =>
      calculateBiltyTotals({
        ...current,
        [name]: event.target.value,
      })
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id) {
      return;
    }

    setSaving(true);

    try {
      const response = await createBilty({ biltyId: id, formData });
      showSuccess(response.data.message || "Bilty updated successfully.");
    } catch (err) {
      showError(getApiErrorMessage(err, "Failed to update bilty"));
    } finally {
      setSaving(false);
    }
  };

  if (role !== "superadmin") {
    return null;
  }

  return (
    <div className="page-shell">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="card no-print mb-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="inline-flex rounded-pill bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
              Superadmin Bilty Edit
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {formData.biltyNumber || "Edit Bilty"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Changes are allowed until this bilty&apos;s midnight deadline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Back
          </button>
        </div>

        {loading ? <p className="no-print text-slate-500">Loading bilty...</p> : null}

        {!loading && !loadFailed ? (
          <form onSubmit={handleSubmit}>
            <div className="no-print mb-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Bilty Changes"}
              </button>
            </div>
            <BiltyDocument formData={formData} onChange={handleChange} />
          </form>
        ) : null}
      </main>
    </div>
  );
};

export default BiltyEditPage;

import React, { useEffect, useState } from "react";
import { createBilty, requestBiltyNumber } from "../api/biltyApi";
import BiltyDocument from "./BiltyDocument";
import BiltyDownloadButtons from "./BiltyDownloadButtons";
import TermsDocument from "./TermsDocument";
import { useAuth } from "../context/AuthContext";
import {
  initialBiltyFormData,
  type BiltyFormState,
} from "../types/biltyForm";
import { readBiltyDraft, writeBiltyDraft } from "../utils/biltyDraft";

const BiltyForm: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<BiltyFormState>({
    ...initialBiltyFormData,
    bookingClerk: user?.name || "",
  });
  const [biltyId, setBiltyId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSavedBilty, setHasSavedBilty] = useState(false);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      bookingClerk: prev.bookingClerk || user?.name || "",
    }));
  }, [user?.name]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isMounted = true;

    const initializeBilty = async () => {
      setIsPreparing(true);
      setErrorMessage("");
      setStatusMessage("");

      const storedDraft = readBiltyDraft(user.id);

      if (storedDraft?.biltyId && storedDraft.formData?.biltyNumber) {
        if (!isMounted) {
          return;
        }

        setBiltyId(storedDraft.biltyId);
        setFormData({
          ...initialBiltyFormData,
          ...storedDraft.formData,
          bookingClerk: storedDraft.formData.bookingClerk || user.name || "",
        });
        setHasSavedBilty(storedDraft.hasSavedBilty);
        setStatusMessage(
          storedDraft.hasSavedBilty
            ? "Resumed your last saved bilty. If you change anything, save it again before downloading."
            : "Resumed your bilty draft. Continue where you left off."
        );
        setIsPreparing(false);
        return;
      }

      setHasSavedBilty(false);

      try {
        const response = await requestBiltyNumber();

        if (!isMounted) {
          return;
        }

        setBiltyId(String(response.data.biltyId));
        setFormData((prev) => ({
          ...prev,
          biltyNumber: response.data.biltyNumber,
          bookingClerk: prev.bookingClerk || user.name || "",
        }));
        setStatusMessage("Bilty number reserved. Fill the form and save it.");
      } catch (err: any) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          err?.response?.data?.error || "Failed to reserve bilty number"
        );
      } finally {
        if (isMounted) {
          setIsPreparing(false);
        }
      }
    };

    void initializeBilty();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.name]);

  useEffect(() => {
    if (!user?.id || !biltyId || !formData.biltyNumber) {
      return;
    }

    writeBiltyDraft(user.id, {
      biltyId,
      formData,
      hasSavedBilty,
      updatedAt: new Date().toISOString(),
    });
  }, [user?.id, biltyId, formData, hasSavedBilty]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setErrorMessage("");
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (hasSavedBilty) {
      setHasSavedBilty(false);
      setStatusMessage(
        "You updated the bilty. Save it again to refresh the PDF, PNG, and print copy."
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!biltyId) {
      setErrorMessage("Bilty number is not ready yet.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await createBilty({ biltyId, formData });
      setHasSavedBilty(true);
      setStatusMessage(
        response.data.message ||
          "Bilty saved successfully. You can now download the 2-page PDF or PNG copy."
      );
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || "Failed to save bilty");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 w-full overflow-x-auto pb-8">
      <div className="mx-auto min-w-[900px] max-w-[1100px] px-2">
        <div className="card no-print mb-4 flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create Bilty</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isPreparing
                ? "Preparing bilty workspace..."
                : `Reserved bilty no: ${formData.biltyNumber || "—"}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Draft changes stay saved in this browser until you start a new bilty. Save the form first, then download the bilty as a 2-page PDF or PNG set with page 1 as the bilty and page 2 as the terms &amp; conditions.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <BiltyDownloadButtons
              biltyNumber={formData.biltyNumber}
              formData={formData}
              disabled={!hasSavedBilty}
              showPrintButton
            />
            <button
              type="submit"
              disabled={isPreparing || isSaving}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-200 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSaving ? "Saving..." : "Save Bilty"}
            </button>
          </div>
        </div>

        {statusMessage ? (
          <div className="no-print mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 shadow-sm">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="no-print mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm">
            {errorMessage}
          </div>
        ) : null}

        <BiltyDocument formData={formData} onChange={handleChange} />

        <div className="no-print mt-6 rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-5 text-sm leading-7 text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Download note</p>
          <p className="mt-2">
            Use <span className="font-semibold">Download PDF (2 Pages)</span> for one PDF file, or use <span className="font-semibold">Download Images (PNG)</span> to get page 1 as the bilty and page 2 as the terms &amp; conditions image.
          </p>
          <p className="mt-2">
            If needed, you can still use <span className="font-semibold">Print 2 Pages</span> to open the browser print dialog.
          </p>
        </div>

        <TermsDocument printable className="print-only print-page-break mt-8" />
      </div>
    </form>
  );
};

export default BiltyForm;

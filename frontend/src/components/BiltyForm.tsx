import React, { useEffect, useState } from "react";
import { createBilty, requestBiltyNumber } from "../api/biltyApi";
import BiltyDocument from "./BiltyDocument";
import BiltyDownloadButtons from "./BiltyDownloadButtons";
import { useAuth } from "../context/AuthContext";
import {
  initialBiltyFormData,
  type BiltyFormState,
} from "../types/biltyForm";
import { readBiltyDraft, writeBiltyDraft } from "../utils/biltyDraft";

const formatDeadlineTime = (deadline?: string | null) => {
  if (!deadline) {
    return "midnight";
  }

  const parsedDeadline = new Date(deadline);

  if (Number.isNaN(parsedDeadline.getTime())) {
    return "midnight";
  }

  return parsedDeadline.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
  const [deadlineAt, setDeadlineAt] = useState<string | null>(
    user?.biltyAccessExpiresAt || null
  );

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      bookingClerk: prev.bookingClerk || user?.name || "",
    }));
  }, [user?.name]);

  useEffect(() => {
    setDeadlineAt(user?.biltyAccessExpiresAt || null);
  }, [user?.biltyAccessExpiresAt]);

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
          freight:
            typeof user.biltyAccessFreightAmount === "number"
              ? String(user.biltyAccessFreightAmount)
              : storedDraft.formData.freight || "",
          bookingClerk: storedDraft.formData.bookingClerk || user.name || "",
        });
        setHasSavedBilty(storedDraft.hasSavedBilty);
        setDeadlineAt(user.biltyAccessExpiresAt || null);
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
        setDeadlineAt(response.data.expiresAt || user.biltyAccessExpiresAt || null);
        setFormData((prev) => ({
          ...prev,
          biltyNumber: response.data.biltyNumber,
          consignmentNo: String(response.data.consignmentNo),
          freight:
            typeof user.biltyAccessFreightAmount === "number"
              ? String(user.biltyAccessFreightAmount)
              : prev.freight,
          bookingClerk: prev.bookingClerk || user.name || "",
        }));
        setStatusMessage(
          `Bilty number reserved. Fill and save before ${formatDeadlineTime(
            response.data.expiresAt || user.biltyAccessExpiresAt || null
          )}.`
        );
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

    if (name === "consignmentNo") {
      return;
    }

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
            {deadlineAt ? (
              <p className="mt-1 text-sm font-medium text-amber-700">
                Save before {formatDeadlineTime(deadlineAt)} today.
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              Draft changes stay saved in this browser until you start a new bilty. Save the form first, then download the bilty as a 2-page PDF or PNG set with page 1 as the bilty and page 2 as the terms &amp; conditions.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <BiltyDownloadButtons
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

        <div className="print-pages">
          <div className="print-page print-bilty-page">
            <BiltyDocument
              formData={formData}
              onChange={handleChange}
              freightReadOnly={typeof user?.biltyAccessFreightAmount === "number"}
            />
          </div>
        </div>
      </div>
    </form>
  );
};

export default BiltyForm;

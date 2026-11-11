import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createBilty,
  extractBillData,
  getBilty,
  markBiltyPrinted,
  requestBiltyNumber,
} from "../api/biltyApi";
import { getContacts } from "../api/contactsApi";
import type { SavedContact } from "../api/contactsApi";
import BiltyDocument from "./BiltyDocument";
import BiltyDownloadButtons, { type PrintCopies } from "./BiltyDownloadButtons";
import BiltyMobileForm from "./BiltyMobileForm";
import BiltyRevisionsModal from "./BiltyRevisionsModal";
import TermsPrintPage from "./TermsPrintPage";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  applyFieldCase,
  calculateBiltyTotals,
  initialBiltyFormData,
  normalizeBiltyFormData,
  type BiltyFormState,
} from "../types/biltyForm";
import type { Suggestion } from "../utils/suggest";
import { clearBiltyDraft, readBiltyDraft, writeBiltyDraft } from "../utils/biltyDraft";

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

/** When the Transporter pays the GST, the user pays this share of the freight. */
const GST_CHARGE_RATE = 0.05;
const round2 = (value: number) => Math.round(value * 100) / 100;
const toAmount = (value: string) => {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const inr = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 });

type GstPrompt = {
  /** "select": just picked Transporter (nothing applied yet). "save": the server asked on Save. */
  origin: "select" | "save";
  freight: number;
  required: number;
  paid: number;
  due: number;
  creditUsed: number;
  cashDue: number;
};

type ExtraPaymentPrompt = {
  extraDue: number;
  newFee: number;
  paidFee: number;
};

/**
 * One form for both creating a bilty and editing a saved one. Pass
 * `editBiltyId` to load and edit an existing bilty instead of reserving a
 * new number.
 */
const BiltyForm: React.FC<{ editBiltyId?: string }> = ({ editBiltyId }) => {
  const navigate = useNavigate();
  const { user, role, updateUser } = useAuth();
  const isEditMode = Boolean(editBiltyId);
  const isSuperadmin = role === "superadmin";
  const { showSuccess, showError, showToast } = useToast();
  const [formData, setFormData] = useState<BiltyFormState>({
    ...initialBiltyFormData,
    bookingClerk: user?.name || "",
  });
  const [biltyId, setBiltyId] = useState("");
  // Persistent state description (deadline reminder, resumed-draft note,
  // scan-in-progress) — distinct from one-off action results (save
  // succeeded/failed, scan succeeded/failed), which go through toasts below
  // instead, since those are exactly the "nothing told me what happened"
  // gaps that were reported.
  const [statusMessage, setStatusMessage] = useState("");
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSavedBilty, setHasSavedBilty] = useState(false);
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [printedAt, setPrintedAt] = useState<string | null>(null);
  // The form as last saved. Save is only clickable while the form differs
  // from this. `null` = unknown (old draft): fall back to "saved before?".
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [baselinePending, setBaselinePending] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [printCopies, setPrintCopies] = useState<PrintCopies>("both");
  const [extraPrompt, setExtraPrompt] = useState<ExtraPaymentPrompt | null>(null);
  const [gstPrompt, setGstPrompt] = useState<GstPrompt | null>(null);
  // GST charge already paid for this bilty, and the total the user has agreed to pay in this session.
  const [gstChargePaid, setGstChargePaid] = useState(0);
  const [gstAck, setGstAck] = useState(0);
  // Popups the user has accepted for the current edit; cleared whenever the form changes.
  const confirms = useRef({ extra: false, gst: false });
  const [consignors, setConsignors] = useState<SavedContact[]>([]);
  const [consignees, setConsignees] = useState<SavedContact[]>([]);
  const [packingOptions, setPackingOptions] = useState<SavedContact[]>([]);
  const [deliveryOptions, setDeliveryOptions] = useState<SavedContact[]>([]);
  const billFileInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [deadlineAt, setDeadlineAt] = useState<string | null>(
    user?.biltyAccessExpiresAt || null
  );

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      bookingClerk: prev.bookingClerk || user?.name || "",
    }));
  }, [user?.name, isEditMode]);

  // Suggestion sources are best-effort: a failed load just means no
  // dropdown, never an error toast.
  useEffect(() => {
    let isMounted = true;

    getContacts("consignor")
      .then((response) => isMounted && setConsignors(response.data))
      .catch(() => undefined);
    getContacts("consignee")
      .then((response) => isMounted && setConsignees(response.data))
      .catch(() => undefined);
    getContacts("packing")
      .then((response) => isMounted && setPackingOptions(response.data))
      .catch(() => undefined);
    getContacts("delivery")
      .then((response) => isMounted && setDeliveryOptions(response.data))
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  const suggestions = useMemo(
    () => ({
      consignor: consignors.map((contact): Suggestion => ({
        text: contact.address,
        sub: contact.gstin || undefined,
      })),
      consignee: consignees.map((contact): Suggestion => ({
        text: contact.address,
        sub: contact.gstin || undefined,
      })),
      packing: packingOptions.map((item): Suggestion => ({ text: item.address })),
      delivery: deliveryOptions.map((item): Suggestion => ({ text: item.address })),
    }),
    [consignors, consignees, packingOptions, deliveryOptions]
  );

  useEffect(() => {
    setDeadlineAt(user?.biltyAccessExpiresAt || null);
  }, [user?.biltyAccessExpiresAt]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!editBiltyId) {
      return;
    }

    let isMounted = true;

    const loadExistingBilty = async () => {
      setIsPreparing(true);
      setLoadFailed(false);

      try {
        const response = await getBilty(editBiltyId);

        if (!isMounted) {
          return;
        }

        setBiltyId(response.data._id);
        setDeadlineAt(response.data.expiresAt || null);
        setPrintedAt(response.data.printedAt || null);
        setGstChargePaid(response.data.gstChargePaid ?? 0);
        setGstAck(response.data.gstChargePaid ?? 0);
        const loaded = {
          ...normalizeBiltyFormData(response.data.formData),
          biltyNumber: response.data.biltyNumber,
          consignmentNo: String(response.data.consignmentNo ?? ""),
        };
        setFormData(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
        setHasSavedBilty(true);
      } catch (err: any) {
        if (isMounted) {
          setLoadFailed(true);
          showError(err?.response?.data?.error || "Failed to load bilty");
        }
      } finally {
        if (isMounted) {
          setIsPreparing(false);
        }
      }
    };

    void loadExistingBilty();

    return () => {
      isMounted = false;
    };
  }, [editBiltyId]);

  useEffect(() => {
    if (isEditMode || !user?.id) {
      return;
    }

    let isMounted = true;

    const initializeBilty = async () => {
      setIsPreparing(true);
      setStatusMessage("");

      const storedDraft = readBiltyDraft(user.id);
      const storedDraftExpired = storedDraft
        ? storedDraft.expiresAt
          ? new Date(storedDraft.expiresAt).getTime() < Date.now()
          : new Date(storedDraft.updatedAt).toDateString() !== new Date().toDateString()
        : false;

      if (storedDraftExpired) {
        clearBiltyDraft(user.id);
      }

      if (!storedDraftExpired && storedDraft?.biltyId && storedDraft.formData?.biltyNumber) {
        if (!isMounted) {
          return;
        }

        setBiltyId(storedDraft.biltyId);
        setFormData(calculateBiltyTotals({
          ...initialBiltyFormData,
          ...storedDraft.formData,
          lorryNo: applyFieldCase("lorryNo", storedDraft.formData.lorryNo || ""),
          consignorGstin: applyFieldCase("consignorGstin", storedDraft.formData.consignorGstin || ""),
          consigneeGstin: applyFieldCase("consigneeGstin", storedDraft.formData.consigneeGstin || ""),
          gstPaidBy: storedDraft.formData.gstPaidBy || "Consignor",
          basisOfBooking: storedDraft.formData.basisOfBooking || "To Pay",
          freight:
            storedDraft.formData.freight ||
            (typeof user.biltyAccessFreightAmount === "number"
              ? String(user.biltyAccessFreightAmount)
              : ""),
          bookingClerk: storedDraft.formData.bookingClerk || user.name || "",
        }));
        setHasSavedBilty(storedDraft.hasSavedBilty);
        setSavedSnapshot(storedDraft.savedSnapshot ?? null);
        setDeadlineAt(user.biltyAccessExpiresAt || null);
        // The stored draft can't know if the bilty was printed since.
        getBilty(storedDraft.biltyId)
          .then((response) => {
            if (!isMounted) return;
            setPrintedAt(response.data.printedAt || null);
            setGstChargePaid(response.data.gstChargePaid ?? 0);
            setGstAck(response.data.gstChargePaid ?? 0);
          })
          .catch(() => undefined);
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
        setFormData((prev) =>
          calculateBiltyTotals({
            ...prev,
            biltyNumber: response.data.biltyNumber,
            consignmentNo: String(response.data.consignmentNo),
            freight:
              typeof user.biltyAccessFreightAmount === "number"
                ? String(user.biltyAccessFreightAmount)
                : prev.freight,
            bookingClerk: prev.bookingClerk || user.name || "",
          })
        );
        setBaselinePending(true);
        setStatusMessage(
          `Bilty number reserved. Fill and save before ${formatDeadlineTime(
            response.data.expiresAt || user.biltyAccessExpiresAt || null
          )}.`
        );
      } catch (err: any) {
        if (!isMounted) {
          return;
        }

        showError(
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
  }, [user?.id, user?.name, isEditMode]);

  useEffect(() => {
    if (isEditMode || !user?.id || !biltyId || !formData.biltyNumber) {
      return;
    }

    writeBiltyDraft(user.id, {
      biltyId,
      formData,
      hasSavedBilty,
      savedSnapshot: savedSnapshot ?? undefined,
      updatedAt: new Date().toISOString(),
      expiresAt: deadlineAt || undefined,
    });
  }, [user?.id, biltyId, formData, hasSavedBilty, savedSnapshot, deadlineAt, isEditMode]);

  // Once a freshly reserved bilty's number is in the form, that untouched
  // state is the baseline: nothing to save until the user changes something.
  useEffect(() => {
    if (baselinePending && formData.biltyNumber) {
      setSavedSnapshot(JSON.stringify(formData));
      setBaselinePending(false);
    }
  }, [baselinePending, formData]);

  const isDirty = useMemo(
    () =>
      savedSnapshot === null
        ? !hasSavedBilty
        : JSON.stringify(formData) !== savedSnapshot,
    [formData, savedSnapshot, hasSavedBilty]
  );

  /** Keeps the GST Charges box at 5% of freight while the Transporter pays the GST (unless the user typed their own value). */
  const withAutoGst = (prev: BiltyFormState, next: BiltyFormState): BiltyFormState => {
    const rateOf = (f: BiltyFormState) => round2(toAmount(f.freight) * GST_CHARGE_RATE);
    const fmt = (n: number) => (n > 0 ? String(n) : "");
    const wasAuto =
      prev.gstPaidBy === "Transporter" && toAmount(prev.gstCharges) === rateOf(prev);
    const nowTransporter = next.gstPaidBy === "Transporter";
    if (nowTransporter && prev.gstPaidBy !== "Transporter") {
      return { ...next, gstCharges: fmt(rateOf(next)) };
    }
    if (nowTransporter && wasAuto) {
      return { ...next, gstCharges: fmt(rateOf(next)) };
    }
    if (!nowTransporter && wasAuto) {
      return { ...next, gstCharges: "" };
    }
    return next;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const name = e.target.dataset.fieldName || e.target.name;
    const { value } = e.target;

    if (name === "consignmentNo") {
      return;
    }

    confirms.current = { extra: false, gst: false };

    if (name === "gstPaidBy" && value === "Transporter" && formData.gstPaidBy !== "Transporter") {
      // The Transporter pays the GST, so the user pays 5% of the freight.
      const freight = toAmount(formData.freight);
      if (freight <= 0) {
        showError("Enter the freight amount first, then choose Transporter.");
        return;
      }
      const required = round2(freight * GST_CHARGE_RATE);
      const covered = Math.max(gstChargePaid, gstAck);
      const due = round2(required - covered);
      if (due > 0.004) {
        const creditUsed = round2(Math.min(user?.creditBalance ?? 0, due));
        setGstPrompt({ origin: "select", freight, required, paid: covered, due, creditUsed, cashDue: round2(due - creditUsed) });
        return; // the radio only changes once they accept the payment
      }
    }

    if (name === "gstPaidBy" && value !== "Transporter" && formData.gstPaidBy === "Transporter" && gstChargePaid > 0) {
      showToast(
        "info",
        `The ₹${inr(gstChargePaid)} GST charge you paid will be credited toward your next bilty fees when you save.`
      );
    }

    setFormData((prev) =>
      calculateBiltyTotals(
        withAutoGst(prev, { ...prev, [name]: applyFieldCase(name, value) })
      )
    );

    if (hasSavedBilty) {
      setHasSavedBilty(false);
      setStatusMessage(
        "You updated the bilty. Save it again to refresh the PDF, PNG, and print copy."
      );
    }
  };

  const handleSelectConsignor = (address: string, gstin: string) => {
    setFormData((prev) =>
      calculateBiltyTotals({
        ...prev,
        consignorAddress: address,
        consignorGstin: applyFieldCase("consignorGstin", gstin),
      })
    );
  };

  const handleSelectConsignee = (address: string, gstin: string) => {
    setFormData((prev) =>
      calculateBiltyTotals({
        ...prev,
        consigneeAddress: address,
        consigneeGstin: applyFieldCase("consigneeGstin", gstin),
      })
    );
  };

  const handleSelectPacking = (value: string) => {
    setFormData((prev) => ({ ...prev, methodOfPacking: value }));

    if (hasSavedBilty) {
      setHasSavedBilty(false);
    }
  };

  const handleSelectDelivery = (value: string) => {
    setFormData((prev) => ({ ...prev, deliveryAddress: value }));

    if (hasSavedBilty) {
      setHasSavedBilty(false);
    }
  };

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) {
      return;
    }

    setIsScanningBill(true);
    setStatusMessage("Reading the bill... this can take a few seconds.");

    try {
      const response = await extractBillData(file);
      if (response.data.retake?.length) {
        // Too blurry / dark / small: nothing was read, ask for a better photo.
        setStatusMessage("");
        showError(response.data.message);
        return;
      }

      const extractedFields: Record<string, string> = { ...(response.data.extractedFields || {}) };

      // A party whose GSTIN is already saved gets its saved (clean) address
      // instead of the OCR'd text.
      const savedFor = (list: SavedContact[], gstin?: string) =>
        gstin ? list.find((c) => (c.gstin || "").toUpperCase() === gstin.toUpperCase()) : undefined;
      const savedConsignor = savedFor(consignors, extractedFields.consignorGstin);
      if (savedConsignor) extractedFields.consignorAddress = savedConsignor.address;
      const savedConsignee = savedFor(consignees, extractedFields.consigneeGstin);
      if (savedConsignee) extractedFields.consigneeAddress = savedConsignee.address;

      const filledFieldCount = Object.values(extractedFields).filter(Boolean).length;
      const warnings = response.data.warnings || [];

      setFormData((prev) => {
        const next = { ...prev };

        for (const [field, value] of Object.entries(extractedFields)) {
          if (value && !next[field as keyof BiltyFormState]) {
            next[field as keyof BiltyFormState] = applyFieldCase(field, value);
          }
        }

        return calculateBiltyTotals(next);
      });

      setStatusMessage("");
      showSuccess(
        filledFieldCount
          ? `${response.data.message} (${filledFieldCount} field${filledFieldCount === 1 ? "" : "s"} filled from the bill.)`
          : response.data.message
      );
      if (warnings.length) {
        // Not an error: the form was filled, these are just things to look at.
        showToast("info", `Please double-check: ${warnings.join("; ")}`);
      }
    } catch (err: any) {
      setStatusMessage("");
      showError(err?.response?.data?.error || "Failed to read the uploaded bill");
    } finally {
      setIsScanningBill(false);
    }
  };

  const submitBilty = async (confirmExtraPayment = false, confirmGst = false) => {
    if (!biltyId) {
      showError("Bilty number is not ready yet.");
      return;
    }

    setIsSaving(true);

    try {
      const sentFormData = formData;
      if (confirmExtraPayment) confirms.current.extra = true;
      if (confirmGst) confirms.current.gst = true;
      const gstRequiredNow =
        formData.gstPaidBy === "Transporter" ? round2(toAmount(formData.freight) * GST_CHARGE_RATE) : 0;
      // Already agreed to (at least) this much GST charge in this session: no need to ask again.
      const gstAgreed = confirms.current.gst || (gstRequiredNow > 0 && gstAck + 0.004 >= gstRequiredNow);
      const response = await createBilty({
        biltyId,
        formData,
        confirmExtraPayment: confirms.current.extra,
        confirmGstPayment: gstAgreed,
      });
      const savedFormData = response.data.bilty.formData;
      if (savedFormData) {
        // What the form looks like once the server's version is merged in;
        // that is the new "saved" baseline.
        setSavedSnapshot(
          JSON.stringify(
            calculateBiltyTotals({
              ...sentFormData,
              ...savedFormData,
              biltyNumber: sentFormData.biltyNumber,
              consignmentNo: sentFormData.consignmentNo,
              gstPaidBy: savedFormData.gstPaidBy || sentFormData.gstPaidBy || "Consignor",
              basisOfBooking:
                savedFormData.basisOfBooking || sentFormData.basisOfBooking || "To Pay",
            })
          )
        );
        setFormData((current) =>
          calculateBiltyTotals({
            ...current,
            ...savedFormData,
            biltyNumber: current.biltyNumber,
            consignmentNo: current.consignmentNo,
            gstPaidBy: savedFormData.gstPaidBy || current.gstPaidBy || "Consignor",
            basisOfBooking:
              savedFormData.basisOfBooking || current.basisOfBooking || "To Pay",
          })
        );
      }
      setExtraPrompt(null);
      setGstPrompt(null);
      confirms.current = { extra: false, gst: false };
      const paidNow = response.data.bilty.gstChargePaid ?? 0;
      setGstChargePaid(paidNow);
      setGstAck(paidNow);
      if ((response.data.gstCredited ?? 0) > 0) {
        showToast("info", `₹${inr(response.data.gstCredited ?? 0)} credited toward your next bilty fees.`);
      }
      if (typeof response.data.creditBalance === "number" && user) {
        updateUser({ ...user, creditBalance: response.data.creditBalance });
      }
      setHasSavedBilty(true);
      setStatusMessage("");
      showSuccess(
        response.data.message ||
          "Bilty saved successfully. You can now print it."
      );
    } catch (err: any) {
      if (err?.response?.status === 402 && err.response.data?.code === "EXTRA_PAYMENT_REQUIRED") {
        // Freight moved into a pricier tier: nothing is saved until the
        // user accepts the extra charge in the popup.
        setExtraPrompt({
          extraDue: Number(err.response.data.extraDue) || 0,
          newFee: Number(err.response.data.newFee) || 0,
          paidFee: Number(err.response.data.paidFee) || 0,
        });
      } else if (err?.response?.status === 402 && err.response.data?.code === "GST_PAYMENT_REQUIRED") {
        // The Transporter pays the GST: the user pays 5% of freight before this saves.
        const d = err.response.data;
        setGstPrompt({
          origin: "save",
          freight: Number(d.freight) || 0,
          required: Number(d.gstRequired) || 0,
          paid: Number(d.gstPaid) || 0,
          due: Number(d.gstDue) || 0,
          creditUsed: Number(d.creditUsed) || 0,
          cashDue: Number(d.cashDue) || 0,
        });
      } else {
        showError(err?.response?.data?.error || "Failed to save bilty");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await submitBilty(false);
  };

  // Past the deadline nobody (superadmin included) can change a bilty. Once
  // printed, only a superadmin can.
  const isExpired = Boolean(deadlineAt && new Date(deadlineAt).getTime() <= now);
  const isPrintLocked = Boolean(printedAt) && !isSuperadmin;
  const isLocked = isExpired || isPrintLocked;
  const showDuplicate = formData.basisOfBooking !== "To Pay";
  const printOriginal = !showDuplicate || printCopies !== "duplicate";
  const printDuplicate = showDuplicate && printCopies !== "original";

  const handleBeforePrint = async () => {
    if (printedAt) {
      return true;
    }

    if (
      !window.confirm(
        "Once you print this bilty it can no longer be changed (only a super admin can). Print now?"
      )
    ) {
      return false;
    }

    try {
      const response = await markBiltyPrinted(biltyId);
      setPrintedAt(response.data.printedAt);
      return true;
    } catch (err: any) {
      showError(err?.response?.data?.error || "Couldn't record the print. Please try again.");
      return false;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 w-full pb-8">
      <div className="mx-auto max-w-[1100px] px-2 sm:px-4">
        <div className="card no-print mb-4 flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEditMode ? "Edit Bilty" : "Create Bilty"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {isPreparing
                ? "Preparing bilty workspace..."
                : `${isEditMode ? "Bilty no" : "Reserved bilty no"}: ${formData.biltyNumber || "—"}`}
            </p>
            {deadlineAt && !isLocked ? (
              <p className="mt-1 text-sm font-medium text-accent-700">
                {isSuperadmin && new Date(deadlineAt).getTime() <= now
                  ? "Deadline passed — superadmin edit."
                  : `Save before ${formatDeadlineTime(deadlineAt)} today.`}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              {isEditMode
                ? "Save your changes, then print the bilty."
                : "Draft changes stay saved in this browser until you start a new bilty. Save the form first, then print the bilty."}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <input
              ref={billFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleBillUpload}
            />
            <button
              type="button"
              disabled={isPreparing || isLocked || isScanningBill}
              onClick={() => billFileInputRef.current?.click()}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isScanningBill ? "Reading bill..." : "Scan Bill to Fill Form"}
            </button>
            {isEditMode ? (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Back
              </button>
            ) : null}
            {isSuperadmin && isEditMode && printedAt ? (
              <button
                type="button"
                onClick={() => setShowRevisions(true)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                Version history
              </button>
            ) : null}
            <BiltyDownloadButtons
              disabled={!hasSavedBilty}
              showPrintButton
              onBeforePrint={handleBeforePrint}
              copies={showDuplicate ? printCopies : undefined}
              onCopiesChange={setPrintCopies}
            />
            <button
              type="submit"
              disabled={isPreparing || isSaving || isLocked || loadFailed || !isDirty}
              title={!isDirty && !isLocked ? "Nothing new to save" : undefined}
              className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-200 disabled:cursor-not-allowed disabled:bg-brand-400"
            >
              {isSaving
                ? "Saving..."
                : isExpired
                  ? "Expired"
                  : isPrintLocked
                    ? "Printed"
                  : !isDirty && hasSavedBilty
                    ? "Saved"
                    : isEditMode
                      ? "Save Changes"
                      : "Save Bilty"}
            </button>
          </div>
        </div>
        <p className="no-print mb-4 text-xs text-slate-500">
          Scanning a bill is best-effort text recognition &mdash; always double-check the filled fields before saving.
        </p>

        {isExpired ? (
          <div className="no-print mb-4 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700 shadow-sm">
            This bilty's deadline has passed, so no one can change it any more.{" "}
            {hasSavedBilty
              ? "You can still print the saved copy below."
              : "It was never saved, so start a new bilty to continue."}
          </div>
        ) : isPrintLocked ? (
          <div className="no-print mb-4 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700 shadow-sm">
            This bilty has been printed, so it can no longer be changed. Only a super admin can
            change a printed bilty.
          </div>
        ) : printedAt && isSuperadmin ? (
          <div className="no-print mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            This bilty was already printed. Your changes are allowed, and the printed version is
            kept as a backup under Version history.
          </div>
        ) : null}
        {statusMessage ? (
          <div className="no-print mb-4 rounded-2xl border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700 shadow-sm">
            {statusMessage}
          </div>
        ) : null}

        <div className="no-print lg:hidden">
          <BiltyMobileForm
            formData={formData}
            onChange={isLocked ? undefined : handleChange}
            onSelectConsignor={isLocked ? undefined : handleSelectConsignor}
            onSelectConsignee={isLocked ? undefined : handleSelectConsignee}
            onSelectPacking={isLocked ? undefined : handleSelectPacking}
            onSelectDelivery={isLocked ? undefined : handleSelectDelivery}
            suggestions={suggestions}
          />
        </div>

        <div className="print-pages mx-auto min-w-[900px] max-w-[1100px] overflow-x-auto">
          {/* On-screen editable page. Never printed: the printed Original and
              Duplicate below are static renders, so placeholders, empty date
              pickers and focus rings can't leak onto paper. */}
          <div className="print-page print-bilty-page print-skip">
            <BiltyDocument
              formData={formData}
              onChange={isLocked ? undefined : handleChange}
              onSelectConsignor={isLocked ? undefined : handleSelectConsignor}
              onSelectConsignee={isLocked ? undefined : handleSelectConsignee}
              onSelectPacking={isLocked ? undefined : handleSelectPacking}
            onSelectDelivery={isLocked ? undefined : handleSelectDelivery}
              suggestions={suggestions}
            />
          </div>
          {printOriginal ? (
            <div className="print-page print-bilty-page print-only-copy">
              <BiltyDocument formData={formData} />
            </div>
          ) : null}
          {printDuplicate ? (
            <div className="print-page print-bilty-page print-only-copy">
              <BiltyDocument formData={formData} basisCopy />
            </div>
          ) : null}
          {/* Terms & conditions: printed once, as the last page of the print job */}
          <div className="print-page print-only-copy">
            <TermsPrintPage />
          </div>
        </div>
      </div>

      {showRevisions && biltyId ? (
        <BiltyRevisionsModal biltyId={biltyId} onClose={() => setShowRevisions(false)} />
      ) : null}

      {gstPrompt ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gst-payment-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
        >
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-xl">
            <h3 id="gst-payment-title" className="text-lg font-bold text-slate-900">
              GST paid by Transporter
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              When the Transporter pays the GST, you pay {Math.round(GST_CHARGE_RATE * 100)}% of the
              freight: ₹{inr(gstPrompt.freight)} × {Math.round(GST_CHARGE_RATE * 100)}% ={" "}
              <strong>₹{inr(gstPrompt.required)}</strong>.
            </p>
            {gstPrompt.paid > 0 ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Already paid: ₹{inr(gstPrompt.paid)}. Balance to pay: <strong>₹{inr(gstPrompt.due)}</strong>.
              </p>
            ) : null}
            {gstPrompt.creditUsed > 0 ? (
              <p className="mt-2 text-sm leading-6 text-success-700">
                Credit from earlier: −₹{inr(gstPrompt.creditUsed)} is applied.
              </p>
            ) : null}
            <p className="mt-3 text-base font-semibold text-slate-900">
              {gstPrompt.cashDue > 0 ? `To pay now: ₹${inr(gstPrompt.cashDue)}` : "Nothing more to pay: your credit covers it."}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              If you lower the freight later, the difference is credited toward your next bilty fees.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setGstPrompt(null);
                  confirms.current = { extra: false, gst: false };
                }}
                disabled={isSaving}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  const prompt = gstPrompt;
                  setGstAck(prompt.required);
                  if (prompt.origin === "select") {
                    // Picked Transporter: apply it now; the charge is recorded when the bilty is saved.
                    setFormData((prev) =>
                      calculateBiltyTotals(withAutoGst(prev, { ...prev, gstPaidBy: "Transporter" }))
                    );
                    setHasSavedBilty(false);
                    setGstPrompt(null);
                  } else {
                    void submitBilty(false, true);
                  }
                }}
                className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-brand-400"
              >
                {isSaving
                  ? "Saving..."
                  : gstPrompt.cashDue > 0
                    ? `Pay ₹${inr(gstPrompt.cashDue)} & continue`
                    : "Use credit & continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {extraPrompt ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="extra-payment-title"
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
        >
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-xl">
            <h3 id="extra-payment-title" className="text-lg font-bold text-slate-900">
              Pay extra to change freight
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This freight amount moves your bilty to a higher tier (₹{extraPrompt.paidFee} → ₹
              {extraPrompt.newFee}). Pay <strong>₹{extraPrompt.extraDue}</strong> extra to save the
              new freight.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setExtraPrompt(null);
                  confirms.current = { extra: false, gst: false };
                }}
                disabled={isSaving}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitBilty(true)}
                disabled={isSaving}
                className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-brand-400"
              >
                {isSaving ? "Saving..." : `Pay ₹${extraPrompt.extraDue} & Save`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
};

export default BiltyForm;

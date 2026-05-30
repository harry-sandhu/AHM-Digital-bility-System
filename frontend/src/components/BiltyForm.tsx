import React, { useEffect, useState } from "react";
import type {
  CSSProperties,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { createBilty, requestBiltyNumber } from "../api/biltyApi";
import TermsDocument from "./TermsDocument";
import { useAuth } from "../context/AuthContext";

const pct = (value: number) => `${value * 100}%`;

const boxStyle = (
  top: number,
  left: number,
  width: number,
  height: number
): CSSProperties => ({
  top: pct(top),
  left: pct(left),
  width: pct(width),
  height: pct(height),
});

type BiltyFormState = {
  lorryNo: string;
  invoiceNoDate: string;
  deliveryAddress: string;
  phoneNo: string;
  insuranceCompany: string;
  insurancePolicyNo: string;
  insuranceDate: string;
  insuranceCertNo: string;
  insuranceAmount: string;
  biltyNumber: string;
  gstPaidBy: string;
  consignorAddress: string;
  consignorGstin: string;
  consigneeAddress: string;
  consigneeGstin: string;
  consignmentNo: string;
  biltyDate: string;
  from: string;
  to: string;
  packages: string;
  methodOfPacking: string;
  description: string;
  actualWt: string;
  chargedWt: string;
  rate: string;
  amount: string;
  freight: string;
  labour: string;
  gstCharges: string;
  biltyCharges: string;
  grandTotal: string;
  advance: string;
  balanceAmt: string;
  declaredValue: string;
  driver: string;
  remarks: string;
  bookingClerk: string;
};

const initialFormData: BiltyFormState = {
  lorryNo: "",
  invoiceNoDate: "",
  deliveryAddress: "",
  phoneNo: "",
  insuranceCompany: "",
  insurancePolicyNo: "",
  insuranceDate: "",
  insuranceCertNo: "",
  insuranceAmount: "",
  biltyNumber: "",
  gstPaidBy: "",
  consignorAddress: "",
  consignorGstin: "",
  consigneeAddress: "",
  consigneeGstin: "",
  consignmentNo: "",
  biltyDate: "",
  from: "",
  to: "",
  packages: "",
  methodOfPacking: "",
  description: "",
  actualWt: "",
  chargedWt: "",
  rate: "",
  amount: "",
  freight: "",
  labour: "",
  gstCharges: "",
  biltyCharges: "",
  grandTotal: "",
  advance: "",
  balanceAmt: "",
  declaredValue: "",
  driver: "",
  remarks: "",
  bookingClerk: "",
};

type PositionedBoxProps = {
  style: CSSProperties;
  label?: string;
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
};

const PositionedBox: React.FC<PositionedBoxProps> = ({
  style,
  label,
  children,
  className = "",
  labelClassName = "",
}) => {
  return (
    <div
      className={`absolute flex flex-col overflow-hidden border border-black bg-white ${className}`}
      style={{ padding: "0.35%", gap: "0.2em", ...style }}
    >
      {label ? (
        <label className={`block shrink-0 text-[0.88em] leading-tight ${labelClassName}`}>
          {label}
        </label>
      ) : null}
      {children}
    </div>
  );
};

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  align?: "left" | "right";
};

const TextInput: React.FC<TextInputProps> = ({
  className = "",
  align = "left",
  ...props
}) => {
  return (
    <input
      {...props}
      className={`w-full min-w-0 border border-black bg-transparent px-[0.35em] py-[0.15em] text-[0.9em] leading-tight outline-none whitespace-nowrap overflow-hidden text-ellipsis ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    />
  );
};

const TextAreaField: React.FC<TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = "",
  style,
  ...props
}) => {
  return (
    <textarea
      {...props}
      className={`w-full min-w-0 flex-1 resize-none border border-black bg-transparent px-[0.35em] py-[0.2em] text-[0.9em] leading-tight outline-none ${className}`}
      style={{
        minHeight: 0,
        overflow: "auto",
        overflowWrap: "anywhere",
        ...style,
      }}
    />
  );
};

const BiltyForm: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<BiltyFormState>({
    ...initialFormData,
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
    let isMounted = true;

    const reserveBilty = async () => {
      setIsPreparing(true);
      setErrorMessage("");
      setStatusMessage("");

      try {
        const response = await requestBiltyNumber();

        if (!isMounted) {
          return;
        }

        setBiltyId(String(response.data.biltyId));
        setFormData((prev) => ({
          ...prev,
          biltyNumber: response.data.biltyNumber,
          bookingClerk: prev.bookingClerk || user?.name || "",
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

    void reserveBilty();

    return () => {
      isMounted = false;
    };
  }, [user?.name]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
          "Bilty saved successfully. You can now print or save the 2-page copy."
      );
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.error || "Failed to save bilty");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 w-full overflow-x-auto pb-8">
      <div className="mx-auto min-w-[900px] max-w-[1100px] px-2">
        <div className="card no-print mb-4 flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create Bilty</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isPreparing
                ? "Reserving bilty number..."
                : `Reserved bilty no: ${formData.biltyNumber || "—"}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Save the form first, then use the print button to download the bilty with page 2 terms & conditions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!hasSavedBilty}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download / Print 2 Pages
            </button>
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

        <div
          className="relative mx-auto aspect-[2/3] w-full border-2 border-black bg-white text-black shadow-sm"
          style={{ fontSize: "clamp(7px, 0.8vw, 12px)" }}
        >
          <div
            className="absolute w-full text-center font-extrabold leading-none text-red-800"
            style={{ top: pct(0.02), fontSize: "clamp(16px, 1.85vw, 30px)" }}
          >
            AHM TRANSPORT SERVICE
          </div>
          <div
            className="absolute w-full px-[5%] text-center text-black"
            style={{ top: pct(0.06), fontSize: "clamp(8px, 1vw, 14px)" }}
          >
            Rampur-Bilaspur Road, Vill. &amp; Post Bhot - 244901 (Uttar Pradesh)
          </div>
          <div
            className="absolute w-full px-[5%] text-center text-black"
            style={{ top: pct(0.08), fontSize: "clamp(7px, 0.92vw, 13px)" }}
          >
            GSTIN: 09CPGPS1323P1ZD | Email: ahmtptservice@gmail.com | A/c No:
            971000294002004 | Branch: Axis Bank, Rampur
          </div>
          <div
            className="absolute left-[5%] w-[90%] border-b border-black"
            style={{ top: pct(0.1) }}
          />

          <PositionedBox style={boxStyle(0.11, 0.05, 0.4, 0.04)} label="Lorry No.">
            <TextInput
              name="lorryNo"
              value={formData.lorryNo}
              onChange={handleChange}
              placeholder="Lorry Number"
              maxLength={20}
              autoCapitalize="characters"
            />
          </PositionedBox>

          <PositionedBox
            style={boxStyle(0.11, 0.55, 0.4, 0.04)}
            label="Invoice No & Date"
          >
            <TextAreaField
              name="invoiceNoDate"
              value={formData.invoiceNoDate}
              onChange={handleChange}
              placeholder="Invoice and Date"
              maxLength={60}
              rows={2}
            />
          </PositionedBox>

          <PositionedBox
            style={boxStyle(0.16, 0.05, 0.9, 0.045)}
            label="Delivery Address"
          >
            <TextAreaField
              name="deliveryAddress"
              value={formData.deliveryAddress}
              onChange={handleChange}
              placeholder="Delivery Address"
              maxLength={130}
              rows={3}
            />
          </PositionedBox>

          <PositionedBox style={boxStyle(0.215, 0.05, 0.4, 0.04)} label="Phone No">
            <TextInput
              name="phoneNo"
              value={formData.phoneNo}
              onChange={handleChange}
              placeholder="Phone Number"
              maxLength={15}
              inputMode="tel"
            />
          </PositionedBox>

          <PositionedBox
            style={boxStyle(0.265, 0.05, 0.9, 0.055)}
            label="Insurance"
            labelClassName="font-semibold"
          >
            <div className="grid h-full min-h-0 grid-cols-5 gap-1">
              <TextInput
                name="insuranceCompany"
                value={formData.insuranceCompany}
                onChange={handleChange}
                placeholder="Company"
                maxLength={25}
              />
              <TextInput
                name="insurancePolicyNo"
                value={formData.insurancePolicyNo}
                onChange={handleChange}
                placeholder="Policy No."
                maxLength={25}
              />
              <TextInput
                name="insuranceDate"
                value={formData.insuranceDate}
                onChange={handleChange}
                placeholder="Date"
                maxLength={10}
              />
              <TextInput
                name="insuranceCertNo"
                value={formData.insuranceCertNo}
                onChange={handleChange}
                placeholder="DEC/CERT No."
                maxLength={25}
              />
              <TextInput
                name="insuranceAmount"
                value={formData.insuranceAmount}
                onChange={handleChange}
                placeholder="Amount"
                maxLength={14}
                align="right"
                inputMode="decimal"
              />
            </div>
          </PositionedBox>

          <PositionedBox style={boxStyle(0.33, 0.05, 0.4, 0.04)} label="Bilty No.">
            <TextInput
              name="biltyNumber"
              value={formData.biltyNumber}
              readOnly
              placeholder="Bilty Number"
              maxLength={22}
            />
          </PositionedBox>

          <PositionedBox
            style={boxStyle(0.33, 0.55, 0.4, 0.04)}
            label="GST Paid By:"
            className="justify-start"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.84em] leading-tight">
              {(["Consignor", "Consignee", "Transporter"] as const).map(
                (option) => (
                  <label
                    key={option}
                    className="inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <input
                      type="radio"
                      name="gstPaidBy"
                      value={option}
                      checked={formData.gstPaidBy === option}
                      onChange={handleChange}
                    />
                    {option}
                  </label>
                )
              )}
            </div>
          </PositionedBox>

          <PositionedBox
            style={boxStyle(0.38, 0.05, 0.4, 0.055)}
            label="Consignor's Name & Address"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-[0.2em]">
              <TextAreaField
                name="consignorAddress"
                value={formData.consignorAddress}
                onChange={handleChange}
                maxLength={110}
                rows={3}
              />
              <TextInput
                name="consignorGstin"
                value={formData.consignorGstin}
                onChange={handleChange}
                placeholder="GSTIN"
                maxLength={15}
                autoCapitalize="characters"
              />
            </div>
          </PositionedBox>

          <PositionedBox
            style={boxStyle(0.38, 0.55, 0.4, 0.055)}
            label="Consignee's Name & Address"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-[0.2em]">
              <TextAreaField
                name="consigneeAddress"
                value={formData.consigneeAddress}
                onChange={handleChange}
                maxLength={110}
                rows={3}
              />
              <TextInput
                name="consigneeGstin"
                value={formData.consigneeGstin}
                onChange={handleChange}
                placeholder="GSTIN"
                maxLength={15}
                autoCapitalize="characters"
              />
            </div>
          </PositionedBox>

          <PositionedBox style={boxStyle(0.445, 0.05, 0.2, 0.035)} label="Consignment No">
            <TextInput
              name="consignmentNo"
              value={formData.consignmentNo}
              onChange={handleChange}
              maxLength={25}
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.445, 0.3, 0.2, 0.035)} label="Date">
            <TextInput
              name="biltyDate"
              value={formData.biltyDate}
              onChange={handleChange}
              maxLength={10}
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.445, 0.55, 0.2, 0.035)} label="From">
            <TextInput
              name="from"
              value={formData.from}
              onChange={handleChange}
              maxLength={24}
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.445, 0.8, 0.15, 0.035)} label="To">
            <TextInput
              name="to"
              value={formData.to}
              onChange={handleChange}
              maxLength={24}
            />
          </PositionedBox>

          <div
            className="absolute overflow-hidden border border-black bg-white"
            style={{ ...boxStyle(0.49, 0.05, 0.9, 0.15), padding: "0.35%" }}
          >
            <div
              className="grid border-b border-gray-400 pb-1 text-center font-semibold"
              style={{ gridTemplateColumns: "1fr 1.5fr 3fr 1.2fr 1.2fr 1fr 1fr" }}
            >
              <span>Number of packages</span>
              <span>Method of Packing</span>
              <span>Description</span>
              <span>Actual Wt.</span>
              <span>Charged Wt.</span>
              <span>Rate</span>
              <span>Amount</span>
            </div>
            <div
              className="mt-1 grid h-[calc(100%-2.3em)] gap-1"
              style={{ gridTemplateColumns: "1fr 1.5fr 3fr 1.2fr 1.2fr 1fr 1fr" }}
            >
              <TextAreaField
                name="packages"
                value={formData.packages}
                onChange={handleChange}
                placeholder="Number"
                maxLength={20}
                rows={2}
              />
              <TextAreaField
                name="methodOfPacking"
                value={formData.methodOfPacking}
                onChange={handleChange}
                placeholder="Method"
                maxLength={25}
                rows={2}
              />
              <TextAreaField
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Description"
                maxLength={55}
                rows={2}
              />
              <TextAreaField
                name="actualWt"
                value={formData.actualWt}
                onChange={handleChange}
                placeholder="Actual Wt."
                maxLength={14}
                rows={2}
              />
              <TextAreaField
                name="chargedWt"
                value={formData.chargedWt}
                onChange={handleChange}
                placeholder="Charged Wt."
                maxLength={14}
                rows={2}
              />
              <TextAreaField
                name="rate"
                value={formData.rate}
                onChange={handleChange}
                placeholder="Rate"
                maxLength={12}
                rows={2}
              />
              <TextAreaField
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="Amount"
                maxLength={15}
                rows={2}
              />
            </div>
          </div>

          <PositionedBox style={boxStyle(0.66, 0.05, 0.2, 0.03)}>
            <TextInput
              name="freight"
              value={formData.freight}
              onChange={handleChange}
              placeholder="Freight"
              maxLength={14}
              align="right"
              inputMode="decimal"
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.66, 0.3, 0.2, 0.03)}>
            <TextInput
              name="labour"
              value={formData.labour}
              onChange={handleChange}
              placeholder="Labour"
              maxLength={14}
              align="right"
              inputMode="decimal"
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.66, 0.55, 0.2, 0.03)}>
            <TextInput
              name="gstCharges"
              value={formData.gstCharges}
              onChange={handleChange}
              placeholder="GST Charges"
              maxLength={14}
              align="right"
              inputMode="decimal"
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.66, 0.8, 0.15, 0.03)}>
            <TextInput
              name="biltyCharges"
              value={formData.biltyCharges}
              onChange={handleChange}
              placeholder="Bilty Charges"
              maxLength={14}
              align="right"
              inputMode="decimal"
            />
          </PositionedBox>

          <PositionedBox style={boxStyle(0.7, 0.05, 0.2, 0.03)}>
            <TextInput
              name="grandTotal"
              value={formData.grandTotal}
              onChange={handleChange}
              placeholder="Grand Total"
              maxLength={14}
              align="right"
              inputMode="decimal"
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.7, 0.3, 0.2, 0.03)}>
            <TextInput
              name="advance"
              value={formData.advance}
              onChange={handleChange}
              placeholder="Advance"
              maxLength={14}
              align="right"
              inputMode="decimal"
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.7, 0.55, 0.2, 0.03)}>
            <TextInput
              name="balanceAmt"
              value={formData.balanceAmt}
              onChange={handleChange}
              placeholder="Balance Amt"
              maxLength={14}
              align="right"
              inputMode="decimal"
            />
          </PositionedBox>

          <PositionedBox style={boxStyle(0.74, 0.05, 0.4, 0.03)}>
            <TextInput
              name="declaredValue"
              value={formData.declaredValue}
              onChange={handleChange}
              placeholder="Declared Value"
              maxLength={25}
            />
          </PositionedBox>
          <PositionedBox style={boxStyle(0.74, 0.55, 0.4, 0.03)}>
            <TextInput
              name="driver"
              value={formData.driver}
              onChange={handleChange}
              placeholder="Driver"
              maxLength={30}
            />
          </PositionedBox>

          <PositionedBox
            style={boxStyle(0.78, 0.05, 0.9, 0.07)}
            label="Signature or Remarks"
          >
            <div className="relative min-h-0 flex-1">
              <TextAreaField
                className="h-full pr-[28%]"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                maxLength={80}
                rows={3}
              />
              <div className="absolute inset-y-0 right-0 w-[25%] border-l border-black bg-white pl-[0.35em]">
                <label className="mb-[0.2em] block text-[0.88em] leading-tight">
                  Booking Clerk
                </label>
                <TextInput
                  className="h-[1.8em]"
                  name="bookingClerk"
                  value={formData.bookingClerk}
                  onChange={handleChange}
                  placeholder="Booking Clerk"
                  maxLength={30}
                />
              </div>
            </div>
          </PositionedBox>

          <PositionedBox style={boxStyle(0.87, 0.05, 0.4, 0.05)}>
            <div className="h-full overflow-hidden break-words text-[0.9em] leading-tight">
              Footer Left
            </div>
          </PositionedBox>
          <PositionedBox style={boxStyle(0.87, 0.55, 0.4, 0.05)}>
            <div className="h-full overflow-hidden break-words text-[0.9em] leading-tight">
              Footer Right
            </div>
          </PositionedBox>
        </div>

        <div className="no-print mt-6 rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-5 text-sm leading-7 text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Download note</p>
          <p className="mt-2">
            When you click <span className="font-semibold">Download / Print 2 Pages</span>, the browser print dialog will open. Choose <span className="font-semibold">Save as PDF</span> to download the bilty with page 1 as the bilty form and page 2 as the terms & conditions attachment.
          </p>
        </div>

        <TermsDocument printable className="print-only print-page-break mt-8" />
      </div>
    </form>
  );
};

export default BiltyForm;

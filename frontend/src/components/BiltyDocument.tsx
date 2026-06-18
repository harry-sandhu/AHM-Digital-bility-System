import React from "react";
import type {
  CSSProperties,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import type { BiltyFormState } from "../types/biltyForm";

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

const normalizeDisplayValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
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
  staticRender?: boolean;
};

const TextInput: React.FC<TextInputProps> = ({
  className = "",
  align = "left",
  staticRender = false,
  value,
  ...props
}) => {
  const alignmentClass = align === "right" ? "text-right" : "text-left";
  const baseClassName = `w-full min-w-0 border border-black bg-transparent px-[0.35em] text-[0.9em] leading-tight text-black ${alignmentClass}`;

  if (staticRender) {
    return (
      <div
        className={`${baseClassName} overflow-hidden whitespace-nowrap py-[0.18em] text-ellipsis ${className}`}
      >
        {normalizeDisplayValue(value) || "\u00A0"}
      </div>
    );
  }

  return (
    <input
      {...props}
      value={value}
      className={`${baseClassName} overflow-hidden whitespace-nowrap py-[0.15em] text-ellipsis outline-none ${className}`}
    />
  );
};

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  staticRender?: boolean;
};

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  className = "",
  style,
  staticRender = false,
  value,
  ...props
}) => {
  const sharedStyle: CSSProperties = {
    minHeight: 0,
    overflowWrap: "anywhere",
    ...style,
  };

  if (staticRender) {
    return (
      <div
        className={`w-full min-w-0 flex-1 overflow-hidden whitespace-pre-wrap break-words border border-black bg-transparent px-[0.35em] py-[0.2em] text-[0.9em] leading-tight text-black ${className}`}
        style={sharedStyle}
      >
        {normalizeDisplayValue(value) || "\u00A0"}
      </div>
    );
  }

  return (
    <textarea
      {...props}
      value={value}
      className={`w-full min-w-0 flex-1 resize-none border border-black bg-transparent px-[0.35em] py-[0.2em] text-[0.9em] leading-tight outline-none ${className}`}
      style={{
        ...sharedStyle,
        overflow: "auto",
      }}
    />
  );
};

type BiltyDocumentProps = {
  formData: BiltyFormState;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  className?: string;
  documentRef?: React.Ref<HTMLDivElement>;
  fontSize?: CSSProperties["fontSize"];
};

const BiltyDocument: React.FC<BiltyDocumentProps> = ({
  formData,
  onChange,
  className = "",
  documentRef,
  fontSize = "clamp(7px, 0.8vw, 12px)",
}) => {
  const editable = Boolean(onChange);
  const staticRender = !editable;
  const gstPaidByOptions = ["Consignor", "Consignee", "Transporter"] as const;

  return (
    <div
      ref={documentRef}
      className={`relative mx-auto aspect-[2/3] w-full border-2 border-black bg-white text-black shadow-sm ${className}`}
      style={{ fontSize }}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
          placeholder="Delivery Address"
          maxLength={130}
          rows={3}
        />
      </PositionedBox>

      <PositionedBox style={boxStyle(0.215, 0.05, 0.4, 0.04)} label="Phone No">
        <TextInput
          name="phoneNo"
          value={formData.phoneNo}
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Company"
            maxLength={25}
          />
          <TextInput
            name="insurancePolicyNo"
            value={formData.insurancePolicyNo}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Policy No."
            maxLength={25}
          />
          <TextInput
            name="insuranceDate"
            value={formData.insuranceDate}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Date"
            maxLength={10}
          />
          <TextInput
            name="insuranceCertNo"
            value={formData.insuranceCertNo}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="DEC/CERT No."
            maxLength={25}
          />
          <TextInput
            name="insuranceAmount"
            value={formData.insuranceAmount}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
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
          staticRender={staticRender}
          placeholder="Bilty Number"
          maxLength={22}
        />
      </PositionedBox>

      <PositionedBox
        style={boxStyle(0.33, 0.55, 0.4, 0.04)}
        label="GST Paid By:"
        className="justify-start"
      >
        {editable ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.84em] leading-tight">
            {gstPaidByOptions.map((option) => (
              <label
                key={option}
                className="inline-flex items-center gap-1 whitespace-nowrap"
              >
                <input
                  type="radio"
                  name="gstPaidBy"
                  value={option}
                  checked={formData.gstPaidBy === option}
                  onChange={onChange}
                  disabled={!editable}
                />
                {option}
              </label>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.84em] leading-tight text-black">
            {gstPaidByOptions.map((option) => (
              <span
                key={option}
                className={`inline-flex items-center gap-1 whitespace-nowrap ${
                  formData.gstPaidBy === option ? "font-semibold" : "opacity-70"
                }`}
              >
                <span>{formData.gstPaidBy === option ? "◉" : "○"}</span>
                {option}
              </span>
            ))}
          </div>
        )}
      </PositionedBox>

      <PositionedBox
        style={boxStyle(0.38, 0.05, 0.4, 0.055)}
        label="Consignor's Name & Address"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-[0.2em]">
          <TextAreaField
            name="consignorAddress"
            value={formData.consignorAddress}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            maxLength={110}
            rows={3}
          />
          <TextInput
            name="consignorGstin"
            value={formData.consignorGstin}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
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
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            maxLength={110}
            rows={3}
          />
          <TextInput
            name="consigneeGstin"
            value={formData.consigneeGstin}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
          maxLength={25}
        />
      </PositionedBox>
      <PositionedBox style={boxStyle(0.445, 0.3, 0.2, 0.035)} label="Date">
        <TextInput
          name="biltyDate"
          value={formData.biltyDate}
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
          maxLength={10}
        />
      </PositionedBox>
      <PositionedBox style={boxStyle(0.445, 0.55, 0.2, 0.035)} label="From">
        <TextInput
          name="from"
          value={formData.from}
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
          maxLength={24}
        />
      </PositionedBox>
      <PositionedBox style={boxStyle(0.445, 0.8, 0.15, 0.035)} label="To">
        <TextInput
          name="to"
          value={formData.to}
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Number"
            maxLength={20}
            rows={2}
          />
          <TextAreaField
            name="methodOfPacking"
            value={formData.methodOfPacking}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Method"
            maxLength={25}
            rows={2}
          />
          <TextAreaField
            name="description"
            value={formData.description}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Description"
            maxLength={55}
            rows={2}
          />
          <TextAreaField
            name="actualWt"
            value={formData.actualWt}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Actual Wt."
            maxLength={14}
            rows={2}
          />
          <TextAreaField
            name="chargedWt"
            value={formData.chargedWt}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Charged Wt."
            maxLength={14}
            rows={2}
          />
          <TextAreaField
            name="rate"
            value={formData.rate}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
            placeholder="Rate"
            maxLength={12}
            rows={2}
          />
          <TextAreaField
            name="amount"
            value={formData.amount}
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
          placeholder="Declared Value"
          maxLength={25}
        />
      </PositionedBox>
      <PositionedBox style={boxStyle(0.74, 0.55, 0.4, 0.03)}>
        <TextInput
          name="driver"
          value={formData.driver}
          onChange={onChange}
          readOnly={!editable}
          staticRender={staticRender}
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
            onChange={onChange}
            readOnly={!editable}
            staticRender={staticRender}
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
              onChange={onChange}
              readOnly={!editable}
              staticRender={staticRender}
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
  );
};

export default BiltyDocument;

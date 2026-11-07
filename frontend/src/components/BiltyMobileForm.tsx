import React from "react";
import type { BiltyFormState } from "../types/biltyForm";

type ChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
) => void;

type BiltyMobileFormProps = {
  formData: BiltyFormState;
  onChange?: ChangeHandler;
  freightReadOnly?: boolean;
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</h3>
    <div className="mt-3 grid gap-3">{children}</div>
  </div>
);

const fieldClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const Field: React.FC<{
  label: string;
  name: keyof BiltyFormState;
  value: string;
  onChange?: ChangeHandler;
  type?: string;
  readOnly?: boolean;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
}> = ({ label, name, value, onChange, type = "text", readOnly = false, inputMode, placeholder }) => {
  const id = `mobile-${name}`;

  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        readOnly={readOnly || !onChange}
        disabled={readOnly && !onChange}
        inputMode={inputMode}
        placeholder={placeholder}
        className={fieldClassName}
      />
    </label>
  );
};

const Area: React.FC<{
  label: string;
  name: keyof BiltyFormState;
  value: string;
  onChange?: ChangeHandler;
  rows?: number;
  placeholder?: string;
}> = ({ label, name, value, onChange, rows = 3, placeholder }) => {
  const id = `mobile-${name}`;

  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <textarea
        id={id}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        readOnly={!onChange}
        rows={rows}
        placeholder={placeholder}
        className={`${fieldClassName} resize-none`}
      />
    </label>
  );
};

const RadioGroup: React.FC<{
  label: string;
  name: keyof BiltyFormState;
  options: readonly string[];
  value: string;
  onChange?: ChangeHandler;
}> = ({ label, name, options, value, onChange }) => (
  <fieldset>
    <legend className="mb-1 block text-xs font-medium text-slate-600">{label}</legend>
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {options.map((option) => (
        <label key={option} className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name={name}
            value={option}
            checked={(value || options[0]) === option}
            onChange={onChange}
            disabled={!onChange}
            className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-400"
          />
          {option}
        </label>
      ))}
    </div>
  </fieldset>
);

const BiltyMobileForm: React.FC<BiltyMobileFormProps> = ({ formData, onChange, freightReadOnly = false }) => {
  return (
    <div className="grid gap-4">
      <Section title="Reserved Bilty">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bilty Number" name="biltyNumber" value={formData.biltyNumber} readOnly />
          <Field label="Consignment No." name="consignmentNo" value={formData.consignmentNo} readOnly />
        </div>
        <Field label="Bilty Date" name="biltyDate" type="date" value={formData.biltyDate} onChange={onChange} />
      </Section>

      <Section title="Lorry & Contact">
        <Field label="Lorry No." name="lorryNo" value={formData.lorryNo} onChange={onChange} placeholder="Lorry number" />
        <Field label="Phone No." name="phoneNo" value={formData.phoneNo} onChange={onChange} inputMode="tel" placeholder="Phone number" />
      </Section>

      <Section title="Delivery Address">
        <Area label="Delivery Address" name="deliveryAddress" value={formData.deliveryAddress} onChange={onChange} rows={3} />
      </Section>

      <Section title="Invoice">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice No." name="invoiceNoDate" value={formData.invoiceNoDate} onChange={onChange} />
          <Field label="Invoice Date" name="invoiceDate" type="date" value={formData.invoiceDate} onChange={onChange} />
        </div>
        <RadioGroup
          label="GST Paid By"
          name="gstPaidBy"
          options={["Consignor", "Consignee", "Transporter"]}
          value={formData.gstPaidBy}
          onChange={onChange}
        />
      </Section>

      <Section title="Insurance">
        <Field label="Company" name="insuranceCompany" value={formData.insuranceCompany} onChange={onChange} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Policy No." name="insurancePolicyNo" value={formData.insurancePolicyNo} onChange={onChange} />
          <Field label="DEC/Cert No." name="insuranceCertNo" value={formData.insuranceCertNo} onChange={onChange} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" name="insuranceDate" type="date" value={formData.insuranceDate} onChange={onChange} />
          <Field label="Amount" name="insuranceAmount" value={formData.insuranceAmount} onChange={onChange} inputMode="decimal" />
        </div>
      </Section>

      <Section title="Consignor">
        <Area label="Name & Address" name="consignorAddress" value={formData.consignorAddress} onChange={onChange} rows={3} />
        <Field label="GSTIN" name="consignorGstin" value={formData.consignorGstin} onChange={onChange} />
      </Section>

      <Section title="Consignee">
        <Area label="Name & Address" name="consigneeAddress" value={formData.consigneeAddress} onChange={onChange} rows={3} />
        <Field label="GSTIN" name="consigneeGstin" value={formData.consigneeGstin} onChange={onChange} />
      </Section>

      <Section title="Route">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" name="from" value={formData.from} onChange={onChange} />
          <Field label="To" name="to" value={formData.to} onChange={onChange} />
        </div>
      </Section>

      <Section title="Goods">
        <Area label="Method Of Packing" name="methodOfPacking" value={formData.methodOfPacking} onChange={onChange} rows={2} />
        <Field label="No. of Packages" name="packages" value={formData.packages} onChange={onChange} />
        <Area label="Description" name="description" value={formData.description} onChange={onChange} rows={3} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Actual Wt." name="actualWt" value={formData.actualWt} onChange={onChange} />
          <Field label="Charged Wt." name="chargedWt" value={formData.chargedWt} onChange={onChange} />
          <Field label="Rate" name="rate" value={formData.rate} onChange={onChange} />
        </div>
      </Section>

      <Section title="Basis of Booking">
        <RadioGroup
          label="Basis of Booking"
          name="basisOfBooking"
          options={["To Pay", "PAID", "T.B.B"]}
          value={formData.basisOfBooking}
          onChange={onChange}
        />
      </Section>

      <Section title="Charges">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Freight"
            name="freight"
            value={formData.freight}
            onChange={onChange}
            readOnly={freightReadOnly}
            inputMode="decimal"
          />
          <Field label="Labour" name="labour" value={formData.labour} onChange={onChange} inputMode="decimal" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="GST Charges" name="gstCharges" value={formData.gstCharges} onChange={onChange} inputMode="decimal" />
          <Field label="Bilty Charges" name="biltyCharges" value={formData.biltyCharges} onChange={onChange} inputMode="decimal" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kanta" name="kanta" value={formData.kanta} onChange={onChange} inputMode="decimal" />
          <Field label="Grand Total" name="grandTotal" value={formData.grandTotal} readOnly />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Advance" name="advance" value={formData.advance} onChange={onChange} inputMode="decimal" />
          <Field label="Balance Amount" name="balanceAmt" value={formData.balanceAmt} readOnly />
        </div>
      </Section>

      <Section title="Declared Value & Driver">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Declared Value" name="declaredValue" value={formData.declaredValue} onChange={onChange} inputMode="decimal" />
          <Field label="Driver" name="driver" value={formData.driver} onChange={onChange} />
        </div>
      </Section>

      <Section title="Remarks & Booking Clerk">
        <Area label="Signature or Remarks" name="remarks" value={formData.remarks} onChange={onChange} rows={3} />
        <Field label="Booking Clerk" name="bookingClerk" value={formData.bookingClerk} onChange={onChange} />
      </Section>
    </div>
  );
};

export default BiltyMobileForm;

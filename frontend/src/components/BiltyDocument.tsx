import type { CSSProperties, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { BiltyFormState } from "../types/biltyForm";

const pct = (value: number) => `${value * 100}%`;

const boxStyle = (top: number, left: number, width: number, height: number): CSSProperties => ({
    top: pct(top),
    left: pct(left),
    width: pct(width),
    height: pct(height),
});

const normalizeDisplayValue = (value: unknown) => {
    if (Array.isArray(value)) return value.join(", ");
    if (value === null || value === undefined) return "";
    return String(value);
};

const getFittedTextStyle = (value: unknown, multiline = false): CSSProperties => {
    const text = normalizeDisplayValue(value).replace(/\s+/g, " ").trim();
    const length = text.length;

    if (!length) return {};

    if (multiline) {
        if (length > 120) return { fontSize: "0.72em", lineHeight: 1.05 };
        if (length > 70) return { fontSize: "0.8em", lineHeight: 1.08 };
        return { fontSize: "0.88em", lineHeight: 1.12 };
    }

    if (length > 40) return { fontSize: "0.74em", lineHeight: 1.05 };
    if (length > 24) return { fontSize: "0.82em", lineHeight: 1.05 };
    return { fontSize: "0.9em", lineHeight: 1.05 };
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
}) => (
    <div
        className={`absolute flex flex-col overflow-hidden border border-black bg-white ${className}`}
        style={{ padding: "0.35%", gap: "0.2em", ...style }}
    >
        {label ? (
            <label className={`block shrink-0 text-[0.88em] leading-tight ${labelClassName}`}>{label}</label>
        ) : null}
        {children}
    </div>
);

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
    align?: "left" | "right";
    staticRender?: boolean;
};

const TextInput: React.FC<TextInputProps> = ({
    className = "",
    align = "left",
    staticRender = false,
    value,
    style,
    ...props
}) => {
    const alignmentClass = align === "right" ? "text-right" : "text-left";
    const baseClassName =
        `w-full min-w-0 border border-black bg-transparent px-[0.35em] ` +
        `text-[0.9em] leading-tight text-black ${alignmentClass}`;

    if (staticRender) {
        return (
            <div
                className={`${baseClassName} flex min-h-[1.7em] items-center overflow-hidden py-[0.18em] text-[0.9em] ${className}`}
                style={style}
                title={normalizeDisplayValue(value)}
            >
                <span
                    className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                    style={getFittedTextStyle(value)}
                >
                    {normalizeDisplayValue(value) || "\u00A0"}
                </span>
            </div>
        );
    }

    return (
        <div className={`${baseClassName} flex min-h-[1.7em] items-center overflow-hidden py-[0.15em] ${className}`} style={style}>
            <input
                {...props}
                value={value}
                className="h-full min-h-0 w-full min-w-0 overflow-hidden border-0 bg-transparent p-0 text-inherit leading-tight outline-none"
            />
        </div>
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
                className={`w-full min-w-0 flex-1 overflow-hidden border border-black bg-transparent px-[0.35em] py-[0.2em] text-[0.9em] leading-tight text-black ${className}`}
                style={sharedStyle}
                title={normalizeDisplayValue(value)}
            >
                <span
                    className="block max-h-full min-w-0 max-w-full overflow-hidden whitespace-pre-wrap break-words"
                    style={getFittedTextStyle(value, true)}
                >
                    {normalizeDisplayValue(value) || "\u00A0"}
                </span>
            </div>
        );
    }

    return (
        <div
            className={`flex w-full min-w-0 flex-1 overflow-hidden border border-black bg-transparent ${className}`}
            style={sharedStyle}
        >
            <textarea
                {...props}
                value={value}
                className="h-full min-h-0 w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent px-[0.35em] py-[0.2em] text-[0.9em] leading-tight outline-none"
            />
        </div>
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
    const basisOfBookingOptions = ["To Pay", "PAID", "T.B.B"] as const;

    return (
        <div
            ref={documentRef}
            className={`relative mx-auto aspect-[210/297] w-full border-2 border-black bg-white text-black shadow-sm ${className}`}
            style={{ fontSize }}
        >
            {/* Header */}
            <div
                className="absolute w-full text-center font-extrabold leading-none text-red-800"
                style={{ top: pct(0.018), fontSize: "clamp(16px, 1.85vw, 30px)" }}
            >
                AHM TRANSPORT SERVICE
            </div>
            <div
                className="absolute w-full px-[5%] text-center text-black"
                style={{ top: pct(0.058), fontSize: "clamp(8px, 1vw, 14px)" }}
            >
                Rampur-Bilaspur Road, Vill. &amp; Post Bhot - 244901 (Uttar Pradesh)
            </div>
            <div
                className="absolute w-full px-[5%] text-center text-black"
                style={{ top: pct(0.081), fontSize: "clamp(7px, 0.92vw, 13px)" }}
            >
                GSTIN: 09CPGPS1323P1ZD | PAN No: CPGPS1323P | Email: ahmtptservice@gmail.com | A/c No: 971000294002004 | Branch: Axis Bank,
                Rampur
            </div>
            <div className="absolute left-[5%] w-[90%] border-b border-black" style={{ top: pct(0.103) }} />

            {/* Lorry / Invoice / Phone */}
            <PositionedBox style={boxStyle(0.112, 0.05, 0.2, 0.052)} label="Lorry No.">
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

            <PositionedBox style={boxStyle(0.112, 0.26, 0.54, 0.052)} label="Invoice No. & Date">
                <TextInput
                    name="invoiceNoDate"
                    value={formData.invoiceNoDate}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Invoice No. & Date"
                    maxLength={60}
                />
            </PositionedBox>

            <PositionedBox style={boxStyle(0.112, 0.81, 0.14, 0.052)} label="Phone No.">
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

            {/* Delivery 4:1 Insurance */}
            <PositionedBox style={boxStyle(0.174, 0.05, 0.72, 0.105)} label="Delivery Address">
                <TextAreaField
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Delivery Address"
                    maxLength={130}
                    rows={4}
                />
            </PositionedBox>

            <PositionedBox style={boxStyle(0.174, 0.78, 0.17, 0.105)} label="Insurance" labelClassName="font-semibold">
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-[0.16em]">
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
                    <input
                        name="insuranceDate"
                        type="date"
                        value={formData.insuranceDate ?? ""}
                        onChange={onChange}
                        disabled={!editable}
                        className="w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border border-black bg-transparent px-[0.35em] text-[0.9em] leading-tight outline-none"
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

            {/* Consignment Note */}
            <PositionedBox style={boxStyle(0.289, 0.05, 0.68, 0.055)} label="Consignment Note No.">
                <div className="grid min-h-0 flex-1 grid-cols-[1fr_0.42fr] gap-1">
                    <TextInput
                        name="consignmentNo"
                        value={formData.consignmentNo}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Consignment Note Number"
                        maxLength={25}
                    />
                    <input
                        name="biltyDate"
                        type="date"
                        value={formData.biltyDate ?? ""}
                        onChange={onChange}
                        disabled={!editable}
                        className="w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border border-black bg-transparent px-[0.35em] text-[0.9em] leading-tight outline-none"
                    />
                </div>
            </PositionedBox>

            <PositionedBox style={boxStyle(0.289, 0.74, 0.21, 0.055)} label="GST Paid By" className="justify-start">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82em] leading-tight">
                    {gstPaidByOptions.map(option =>
                        editable ? (
                            <label key={option} className="inline-flex items-center gap-1 whitespace-nowrap">
                                <input
                                    type="radio"
                                    name="gstPaidBy"
                                    value={option}
                                    checked={formData.gstPaidBy === option}
                                    onChange={onChange}
                                />
                                {option}
                            </label>
                        ) : (
                            <span key={option} className="inline-flex items-center gap-1 whitespace-nowrap">
                                <span>{formData.gstPaidBy === option ? "◉" : "○"}</span>
                                {option}
                            </span>
                        ),
                    )}
                </div>
            </PositionedBox>

            {/* Consignor / Consignee / vertical From / To */}
            <div
                className="absolute grid overflow-hidden border border-black bg-white"
                style={{ ...boxStyle(0.354, 0.05, 0.9, 0.125), gridTemplateColumns: "1.35fr 1.35fr 0.45fr 0.45fr" }}
            >
                <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                    <label className="block shrink-0 text-[0.88em] leading-tight">
                        Consignor&apos;s Name &amp; Address
                    </label>
                    <TextAreaField
                        name="consignorAddress"
                        value={formData.consignorAddress}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        maxLength={110}
                        rows={4}
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

                <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                    <label className="block shrink-0 text-[0.88em] leading-tight">
                        Consignee&apos;s Name &amp; Address
                    </label>
                    <TextAreaField
                        name="consigneeAddress"
                        value={formData.consigneeAddress}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        maxLength={110}
                        rows={4}
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

                <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                    <label className="text-center text-[0.88em] leading-tight">From</label>
                    <TextAreaField
                        name="from"
                        value={formData.from}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        maxLength={24}
                        rows={5}
                    />
                </div>

                <div className="flex min-w-0 flex-col p-[0.35%]">
                    <label className="text-center text-[0.88em] leading-tight">To</label>
                    <TextAreaField
                        name="to"
                        value={formData.to}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        maxLength={24}
                        rows={5}
                    />
                </div>
            </div>

            {/* Main consignment / weights / amount table */}
            <div
                className="absolute grid overflow-hidden border border-black bg-white"
                style={{
                    ...boxStyle(0.49, 0.05, 0.9, 0.245),
                    gridTemplateColumns: "0.9fr 2.65fr 1.6fr 1.45fr",
                }}
            >
                {/* Method of packing + number of packages */}
                <div className="grid min-w-0 grid-rows-2 border-r border-black">
                    <div className="flex min-w-0 flex-col border-b border-black p-[0.45%]">
                        <label className="text-center text-[0.88em] font-semibold">Method Of Packing</label>
                        <TextAreaField
                            name="methodOfPacking"
                            value={formData.methodOfPacking}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Method Of Packing"
                            maxLength={25}
                            rows={3}
                        />
                    </div>
                    <div className="flex min-w-0 flex-col p-[0.45%]">
                        <label className="text-center text-[0.88em] font-semibold">No. of Packages</label>
                        <TextAreaField
                            name="packages"
                            value={formData.packages}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="No. of Packages"
                            maxLength={20}
                            rows={3}
                        />
                    </div>
                </div>

                {/* Description */}
                <div className="flex min-w-0 flex-col border-r border-black p-[0.45%]">
                    <label className="text-center text-[0.88em] font-semibold">Description</label>
                    <TextAreaField
                        name="description"
                        value={formData.description}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Description"
                        maxLength={100}
                        rows={8}
                    />
                </div>

                {/* Weight/Rate upper + Basis of Booking lower */}
                <div className="grid min-w-0 grid-rows-[1fr_1fr] border-r border-black">
                    <div className="grid min-w-0 grid-cols-3 border-b border-black">
                        <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                            <label className="whitespace-nowrap text-center text-[0.8em] font-semibold">Actual Wt.</label>
                            <TextAreaField
                                name="actualWt"
                                value={formData.actualWt}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                placeholder="Actual"
                                maxLength={14}
                                rows={3}
                            />
                        </div>
                        <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                            <label className="whitespace-nowrap text-center text-[0.8em] font-semibold">Charged Wt.</label>
                            <TextAreaField
                                name="chargedWt"
                                value={formData.chargedWt}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                placeholder="Charged"
                                maxLength={14}
                                rows={3}
                            />
                        </div>
                        <div className="flex min-w-0 flex-col p-[0.35%]">
                            <label className="whitespace-nowrap text-center text-[0.8em] font-semibold">Rate</label>
                            <TextAreaField
                                name="rate"
                                value={formData.rate}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                placeholder="Rate"
                                maxLength={12}
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col p-[0.45%]">
                        <label className="text-center text-[0.88em] font-semibold">Basis of Booking</label>
                        <div className="flex flex-1 flex-col items-center justify-center gap-y-1 text-[0.88em]">
                            {basisOfBookingOptions.map(option =>
                                editable ? (
                                    <label key={option} className="inline-flex items-center gap-1 whitespace-nowrap">
                                        <input
                                            type="radio"
                                            name="basisOfBooking"
                                            value={option}
                                            checked={formData.basisOfBooking === option}
                                            onChange={onChange}
                                        />
                                        {option}
                                    </label>
                                ) : (
                                    <span key={option} className="inline-flex items-center gap-1 whitespace-nowrap">
                                        <span>{formData.basisOfBooking === option ? "◉" : "○"}</span>
                                        {option}
                                    </span>
                                ),
                            )}
                        </div>
                    </div>
                </div>

                {/* Amount column */}
                <div className="grid min-w-0 grid-rows-[auto_repeat(7,minmax(0,1fr))]">
                    <div className="flex items-center justify-center border-b border-black text-[0.88em] font-semibold">
                        Amount
                    </div>
                    {[
                        ["Freight", "freight"],
                        ["Labour", "labour"],
                        ["GST Charges", "gstCharges"],
                        ["Bilty Charges", "biltyCharges"],
                        ["Grand Total", "grandTotal"],
                        ["Advance", "advance"],
                        ["Balance Amount", "balanceAmt"],
                    ].map(([label, name], index) => (
                        <div
                            key={name}
                            className={`grid min-w-0 grid-cols-[0.9fr_1.1fr] ${
                                index < 6 ? "border-b border-black" : ""
                            }`}
                        >
                            <div className="flex items-center border-r border-black px-[0.35em] text-[0.78em] font-semibold leading-tight">
                                {label}
                            </div>
                            <TextInput
                                name={name}
                                value={formData[name as keyof BiltyFormState] as string}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                align="right"
                                inputMode="decimal"
                                className="border-0"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Declared value / Driver */}
            <PositionedBox style={boxStyle(0.747, 0.05, 0.4, 0.038)} label="Declared Value">
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

            <PositionedBox style={boxStyle(0.747, 0.55, 0.4, 0.038)} label="Driver">
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

            {/* Signature / Remarks */}
            <PositionedBox style={boxStyle(0.795, 0.05, 0.9, 0.075)} label="Signature or Remarks">
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
                        <label className="mb-[0.2em] block text-[0.88em] leading-tight">Booking Clerk</label>
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

        </div>
    );
};

export default BiltyDocument;

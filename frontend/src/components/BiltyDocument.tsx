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

const tieredFontSize = (value: unknown, tiers: Array<[number, string]>): string => {
    const length = normalizeDisplayValue(value).trim().length;
    for (const [maxLen, size] of tiers) {
        if (length <= maxLen) return size;
    }
    return tiers[tiers.length - 1][1];
};

const DEFAULT_SINGLE_LINE_TIERS: Array<[number, string]> = [
    [6, "1.55em"],
    [10, "1.45em"],
    [15, "1.35em"],
    [22, "1.25em"],
    [30, "1.2em"],
    [45, "1.15em"],
];

const NARROW_SINGLE_LINE_TIERS: Array<[number, string]> = [
    [4, "1.45em"],
    [6, "1.35em"],
    [9, "1.25em"],
    [14, "1.15em"],
    [20, "1em"],
    [26, "0.82em"],
    [34, "0.7em"],
];

const GENEROUS_SINGLE_LINE_TIERS: Array<[number, string]> = [
    [8, "1.7em"],
    [14, "1.5em"],
    [22, "1.35em"],
    [35, "1.2em"],
    [50, "1.17em"],
];

const MULTILINE_TIERS: Record<"narrow" | "compact" | "normal" | "wide", Array<[number, string]>> = {
    narrow: [
        [4, "1.3em"],
        [8, "1.2em"],
        [14, "1.1em"],
        [24, "1em"],
    ],
    compact: [
        [6, "1.35em"],
        [10, "1.2em"],
        [16, "1.1em"],
        [24, "1em"],
    ],
    normal: [
        [10, "1.5em"],
        [20, "1.35em"],
        [40, "1.15em"],
        [70, "1em"],
        [120, "0.95em"],
    ],
    wide: [
        [20, "1.7em"],
        [45, "1.5em"],
        [80, "1.3em"],
        [130, "1.1em"],
    ],
};

const SECTION_LABEL_CLASS = "font-bold uppercase tracking-[0.04em] text-black";
const FIELD_LABEL_CLASS = "font-semibold text-slate-700 tracking-[0.015em]";

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
            <label className={`block shrink-0 text-[0.85em] leading-tight ${labelClassName || FIELD_LABEL_CLASS}`}>
                {label}
            </label>
        ) : null}
        {children}
    </div>
);

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
    align?: "left" | "right";
    bordered?: boolean;
    staticRender?: boolean;
    tiers?: Array<[number, string]>;
};

const TextInput: React.FC<TextInputProps> = ({
    className = "",
    align = "left",
    bordered = false,
    staticRender = false,
    tiers = DEFAULT_SINGLE_LINE_TIERS,
    value,
    style,
    ...props
}) => {
    const alignmentClass = align === "right" ? "text-right" : "text-left";
    const baseClassName =
        `w-full min-w-0 ${bordered ? "border border-black" : "border-0"} bg-transparent px-[0.2em] ` +
        `text-[1.55em] leading-tight text-black ${alignmentClass}`;
    const autoStyle: CSSProperties = { fontSize: tieredFontSize(value, tiers), ...style };

    if (staticRender) {
        return (
            <div
                className={`${baseClassName} flex min-h-[1.7em] items-center overflow-hidden py-[0.08em] ${className}`}
                style={autoStyle}
                title={normalizeDisplayValue(value)}
            >
                <span className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    {normalizeDisplayValue(value) || "\u00A0"}
                </span>
            </div>
        );
    }

    return (
        <div className={`${baseClassName} flex min-h-[1.7em] items-center overflow-hidden py-[0.15em] ${className}`} style={autoStyle}>
            <input
                {...props}
                value={value}
                className="h-full min-h-0 w-full min-w-0 overflow-hidden border-0 bg-transparent p-0 text-inherit leading-tight outline-none"
            />
        </div>
    );
};

const formatStaticDate = (value: unknown) => {
    const raw = normalizeDisplayValue(value);
    if (!raw) return "";
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString("en-GB");
};

const DateInputIcon: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
    <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`no-print pointer-events-none absolute top-1/2 -translate-y-1/2 text-black ${
            compact ? "right-[0.1em] h-[0.9em] w-[0.9em]" : "right-[0.25em] h-[1.1em] w-[1.1em]"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
    >
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M16 2.5v4M8 2.5v4M3 9h18" />
    </svg>
);

const DateInput: React.FC<
    InputHTMLAttributes<HTMLInputElement> & { bordered?: boolean; staticRender?: boolean; compact?: boolean }
> = ({ className = "", bordered = false, staticRender = false, compact = false, value, style, ...props }) => {
    const paddingRightClass = compact ? "pr-[1.1em]" : "pr-[1.55em]";
    const fontSizeStyle: CSSProperties = compact ? { fontSize: "0.78em", ...style } : { ...style };

    if (staticRender) {
        return (
            <div
                className={`relative flex w-full min-w-0 items-center overflow-hidden ${bordered ? "border border-black" : "border-0"} bg-transparent pl-[0.2em] ${paddingRightClass} text-[1.5em] leading-tight text-black ${className}`}
                style={fontSizeStyle}
                title={formatStaticDate(value)}
            >
                <DateInputIcon compact={compact} />
                <span className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    {formatStaticDate(value) || " "}
                </span>
            </div>
        );
    }

    return (
        <div className="relative flex h-full w-full min-w-0 items-center">
            <input
                {...props}
                value={value}
                className={`w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${bordered ? "border border-black" : "border-0"} bg-transparent pl-[0.2em] pr-[0.2em] text-[1.5em] leading-tight outline-none ${className}`}
                style={fontSizeStyle}
            />
        </div>
    );
};

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
    bordered?: boolean;
    staticRender?: boolean;
    density?: "narrow" | "compact" | "normal" | "wide";
    centerWhenShort?: boolean;
};

const estimateRows = (value: unknown, maxRows: number, charsPerLine = 22): number => {
    const length = normalizeDisplayValue(value).trim().length;
    if (!length) return Math.min(2, maxRows);
    const needed = Math.ceil(length / charsPerLine) + 1;
    return Math.min(Math.max(needed, 1), maxRows);
};

const TextAreaField: React.FC<TextAreaFieldProps> = ({
    className = "",
    bordered = false,
    style,
    staticRender = false,
    density = "normal",
    centerWhenShort = false,
    value,
    ...props
}) => {
    const autoFontSize = tieredFontSize(value, MULTILINE_TIERS[density]);
    const sharedStyle: CSSProperties = {
        minHeight: 0,
        overflowWrap: "anywhere",
        fontSize: autoFontSize,
        ...style,
    };

    if (staticRender) {
        return (
            <div
                className={`w-full min-w-0 flex-1 overflow-hidden ${bordered ? "border border-black" : "border-0"} bg-transparent px-[0.2em] py-[0.1em] leading-tight text-black ${className}`}
                style={sharedStyle}
                title={normalizeDisplayValue(value)}
            >
                <span className="block max-h-full min-w-0 max-w-full overflow-hidden whitespace-pre-wrap break-words">
                    {normalizeDisplayValue(value) || "\u00A0"}
                </span>
            </div>
        );
    }

    if (centerWhenShort) {
        const effectiveRows = estimateRows(value, Number(props.rows) || 4);
        return (
            <div
                className={`flex w-full min-w-0 overflow-hidden ${bordered ? "border border-black" : "border-0"} bg-transparent ${className}`}
                style={sharedStyle}
            >
                <textarea
                    {...props}
                    rows={effectiveRows}
                    value={value}
                    className="min-h-0 w-full min-w-0 resize-none border-0 bg-transparent px-[0.2em] py-[0.1em] text-inherit leading-tight outline-none"
                />
            </div>
        );
    }

    return (
        <div
            className={`flex w-full min-w-0 flex-1 overflow-hidden ${bordered ? "border border-black" : "border-0"} bg-transparent ${className}`}
            style={sharedStyle}
        >
            <textarea
                {...props}
                value={value}
                className="h-full min-h-0 w-full min-w-0 resize-none border-0 bg-transparent px-[0.2em] py-[0.1em] text-inherit leading-tight outline-none"
            />
        </div>
    );
};

type BiltyDocumentProps = {
  formData: BiltyFormState;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  freightReadOnly?: boolean;
  basisCopy?: boolean;
  className?: string;
    documentRef?: React.Ref<HTMLDivElement>;
    fontSize?: CSSProperties["fontSize"];
};

const BiltyDocument: React.FC<BiltyDocumentProps> = ({
    formData,
    onChange,
    freightReadOnly = false,
    basisCopy = false,
    className = "",
    documentRef,
    fontSize = "clamp(10px, 1vw, 13px)",
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
                className="absolute right-[2%] rounded-sm border border-black px-[0.5em] py-[0.15em] font-bold uppercase tracking-[0.08em] text-black"
                style={{ top: pct(0.014), fontSize: "clamp(7px, 0.85vw, 12px)" }}
            >
                {basisCopy ? "Duplicate" : "Original"}
            </div>
            <div
                className="absolute w-full text-center font-extrabold leading-none text-red-800"
                style={{ top: pct(0.018), fontSize: "clamp(22px, 2.4vw, 38px)" }}
            >
                AHM TRANSPORT SERVICE
            </div>
            <div
                className="absolute w-full px-[5%] text-center text-black"
                style={{ top: pct(0.058), fontSize: "clamp(11px, 1.3vw, 18px)" }}
            >
                Rampur-Bilaspur Road, Vill. &amp; Post Bhot - 244901 (Uttar Pradesh)
            </div>
            <div
                className="absolute w-full px-[5%] text-center text-black"
                style={{ top: pct(0.081), fontSize: "clamp(8px, 1vw, 12px)" }}
            >
                GSTIN: 09CPGPS1323P1ZD | PAN No: CPGPS1323P | Email: ahmtptservice@gmail.com | A/c No: 971000294002004 | I.F.S. Code: UTIB0000795 | Branch: Axis Bank,
                Rampur
            </div>
            <div className="absolute left-[5%] w-[90%] border-b border-black" style={{ top: pct(0.103) }} />

            {/* Lorry / Invoice / Phone */}
            <PositionedBox style={boxStyle(0.112, 0.05, 0.25, 0.052)} label="Lorry No." className="justify-center">
                <TextInput
                    name="lorryNo"
                    value={formData.lorryNo}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Lorry Number"
                    autoCapitalize="characters"
                    tiers={GENEROUS_SINGLE_LINE_TIERS}
                />
            </PositionedBox>

            <PositionedBox style={boxStyle(0.112, 0.31, 0.46, 0.052)}>
                <div className="flex h-full items-center justify-center text-center text-[1.9em] font-semibold leading-tight">
                    AT OWNER&apos;S RISK / FREIGHT BROKER
                </div>
            </PositionedBox>

            <PositionedBox style={boxStyle(0.112, 0.78, 0.17, 0.052)} label="Phone No." className="justify-center">
                <TextInput
                    name="phoneNo"
                    value={formData.phoneNo}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Phone Number"
                    inputMode="tel"
                    tiers={GENEROUS_SINGLE_LINE_TIERS}
                />
            </PositionedBox>

            {/* Delivery 4:1 Insurance */}
            <PositionedBox style={boxStyle(0.174, 0.05, 0.58, 0.105)} label="Delivery Address">
                <TextAreaField
                    name="deliveryAddress"
                    density="wide"
                    value={formData.deliveryAddress}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Delivery Address"
                    rows={4}
                />
            </PositionedBox>

            <PositionedBox style={boxStyle(0.174, 0.64, 0.31, 0.105)} label="Insurance" labelClassName={SECTION_LABEL_CLASS}>
                <div className="grid min-h-0 flex-1 grid-rows-3 gap-[0.16em]">
                    <TextInput
                        name="insuranceCompany"
                        value={formData.insuranceCompany}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Company"
                        tiers={[
                            [12, "1.6em"],
                            [18, "1.4em"],
                            [24, "1.2em"],
                            [32, "1.05em"],
                            [45, "0.92em"],
                        ]}
                    />
                    <div className="grid min-h-0 grid-cols-2 gap-[0.3em]">
                        <TextInput
                            name="insurancePolicyNo"
                            value={formData.insurancePolicyNo}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Policy No."
                            tiers={NARROW_SINGLE_LINE_TIERS}
                        />
                        <TextInput
                            name="insuranceCertNo"
                            value={formData.insuranceCertNo}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="DEC/CERT No."
                            tiers={NARROW_SINGLE_LINE_TIERS}
                        />
                    </div>
                    <div className="grid min-h-0 grid-cols-2 gap-[0.3em]">
                        <DateInput
                            name="insuranceDate"
                            type="date"
                            value={formData.insuranceDate ?? ""}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            compact
                            style={{ fontSize: "1.3em" }}
                        />
                        <TextInput
                            name="insuranceAmount"
                            value={formData.insuranceAmount}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Amount"
                            align="right"
                            tiers={NARROW_SINGLE_LINE_TIERS}
                            inputMode="decimal"
                        />
                    </div>
                </div>
            </PositionedBox>

            {/* Consignment Note */}
            <PositionedBox style={boxStyle(0.289, 0.05, 0.25, 0.055)} label="Consignment Note No." labelClassName={SECTION_LABEL_CLASS}>
                <div className="grid min-h-0 flex-1 grid-cols-[0.75fr_0.65fr] gap-1">
                    <TextInput
                        name="consignmentNo"
                        value={formData.consignmentNo}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Consignment Note Number"
                    />
                    <DateInput
                        name="biltyDate"
                        type="date"
                        value={formData.biltyDate ?? ""}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        compact
                        style={{ fontSize: "1.1em" }}
                    />
                </div>
            </PositionedBox>

            <PositionedBox style={boxStyle(0.289, 0.30, 0.44, 0.055)} label="Invoice No. & Date" labelClassName={SECTION_LABEL_CLASS}>
                <div className="grid min-h-0 flex-1 grid-cols-[1fr_0.42fr] gap-1">
                    <TextInput
                        name="invoiceNoDate"
                        value={formData.invoiceNoDate}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Invoice Number"
                    />
                    <DateInput
                        name="invoiceDate"
                        type="date"
                        value={formData.invoiceDate ?? ""}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        compact
                        style={{ fontSize: "1.4em" }}
                    />
                </div>
            </PositionedBox>

            <PositionedBox style={boxStyle(0.289, 0.74, 0.21, 0.055)} label="GST Paid By" className="justify-start">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.98em] leading-tight">
                    {gstPaidByOptions.map(option =>
                        editable ? (
                            <label key={option} className="inline-flex items-center gap-1 whitespace-nowrap">
                                <input
                                    type="radio"
                                    name={`gstPaidBy-${basisCopy ? "copy" : "primary"}`}
                                    data-field-name="gstPaidBy"
                                    value={option}
                                    checked={(formData.gstPaidBy || "Consignor") === option}
                                    onChange={onChange}
                                />
                                {option}
                            </label>
                        ) : (
                            <span key={option} className="inline-flex items-center gap-1 whitespace-nowrap">
                                <span>{(formData.gstPaidBy || "Consignor") === option ? "◉" : "○"}</span>
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
                    <label className={`block shrink-0 text-[0.85em] leading-tight ${SECTION_LABEL_CLASS}`}>
                        Consignor&apos;s Name &amp; Address
                    </label>
                    <div className="flex min-h-0 flex-1 flex-col justify-center">
                        <TextAreaField
                            name="consignorAddress"
                            density="normal"
                            centerWhenShort
                            value={formData.consignorAddress}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            rows={4}
                        />
                        <TextInput
                            name="consignorGstin"
                            value={formData.consignorGstin}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="GSTIN"
                            autoCapitalize="characters"
                        />
                    </div>
                </div>

                <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                    <label className={`block shrink-0 text-[0.85em] leading-tight ${SECTION_LABEL_CLASS}`}>
                        Consignee&apos;s Name &amp; Address
                    </label>
                    <div className="flex min-h-0 flex-1 flex-col justify-center">
                        <TextAreaField
                            name="consigneeAddress"
                            density="normal"
                            centerWhenShort
                            value={formData.consigneeAddress}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            rows={4}
                        />
                        <TextInput
                            name="consigneeGstin"
                            value={formData.consigneeGstin}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="GSTIN"
                            autoCapitalize="characters"
                        />
                    </div>
                </div>

                <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                    <label className={`text-center text-[0.85em] leading-tight ${FIELD_LABEL_CLASS}`}>From</label>
                    <div className="flex min-h-0 flex-1 flex-col justify-center">
                        <TextAreaField
                            name="from"
                            density="compact"
                            centerWhenShort
                            value={formData.from}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            rows={5}
                        />
                    </div>
                </div>

                <div className="flex min-w-0 flex-col p-[0.35%]">
                    <label className={`text-center text-[0.85em] leading-tight ${FIELD_LABEL_CLASS}`}>To</label>
                    <div className="flex min-h-0 flex-1 flex-col justify-center">
                        <TextAreaField
                            name="to"
                            density="compact"
                            centerWhenShort
                            value={formData.to}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            rows={5}
                        />
                    </div>
                </div>
            </div>

            {/* Main consignment / weights / amount table */}
            <div
                className="absolute grid overflow-hidden border border-black bg-white"
                style={{
                    ...boxStyle(0.49, 0.05, 0.9, 0.245),
                    gridTemplateColumns: "1.05fr 2.15fr 1.95fr 1.45fr",
                }}
            >
                {/* Method of packing + number of packages */}
                <div className="grid min-w-0 grid-rows-2 border-r border-black">
                    <div className="flex min-w-0 flex-col border-b border-black p-[0.45%]">
                        <label className={`text-center text-[0.85em] ${SECTION_LABEL_CLASS}`}>Method Of Packing</label>
                        <div className="flex min-h-0 flex-1 flex-col justify-center">
                            <TextAreaField
                                name="methodOfPacking"
                                density="normal"
                                centerWhenShort
                                value={formData.methodOfPacking}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                placeholder="Method Of Packing"
                                rows={3}
                            />
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-col p-[0.45%]">
                        <label className={`text-center text-[0.85em] ${SECTION_LABEL_CLASS}`}>No. of Packages</label>
                        <div className="flex min-h-0 flex-1 flex-col justify-center">
                            <TextAreaField
                                name="packages"
                                density="normal"
                                centerWhenShort
                                value={formData.packages}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                placeholder="No. of Packages"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div className="flex min-w-0 flex-col border-r border-black p-[0.45%]">
                    <label className={`text-center text-[0.85em] ${SECTION_LABEL_CLASS}`}>Description</label>
                    <div className="flex min-h-0 flex-1 flex-col justify-center">
                        <TextAreaField
                            name="description"
                            density="wide"
                            centerWhenShort
                            value={formData.description}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Description"
                            rows={8}
                        />
                    </div>
                </div>

                {/* Weight/Rate upper + Basis of Booking lower */}
                <div className="grid min-w-0 grid-rows-[1fr_1fr] border-r border-black">
                    <div className="grid min-w-0 grid-cols-3 border-b border-black">
                        <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                            <label className={`whitespace-nowrap text-center text-[0.76em] ${SECTION_LABEL_CLASS}`}>Actual Wt.</label>
                            <div className="flex min-h-0 flex-1 flex-col justify-center">
                                <TextAreaField
                                    name="actualWt"
                                    density="narrow"
                                    centerWhenShort
                                    value={formData.actualWt}
                                    onChange={onChange}
                                    readOnly={!editable}
                                    staticRender={staticRender}
                                    placeholder="Actual"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                            <label className={`whitespace-nowrap text-center text-[0.76em] ${SECTION_LABEL_CLASS}`}>Charged Wt.</label>
                            <div className="flex min-h-0 flex-1 flex-col justify-center">
                                <TextAreaField
                                    name="chargedWt"
                                    density="narrow"
                                    centerWhenShort
                                    value={formData.chargedWt}
                                    onChange={onChange}
                                    readOnly={!editable}
                                    staticRender={staticRender}
                                    placeholder="Charged"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="flex min-w-0 flex-col p-[0.35%]">
                            <label className={`whitespace-nowrap text-center text-[0.76em] ${SECTION_LABEL_CLASS}`}>Rate</label>
                            <div className="flex min-h-0 flex-1 flex-col justify-center">
                                <TextAreaField
                                    name="rate"
                                    density="narrow"
                                    centerWhenShort
                                    value={formData.rate}
                                    onChange={onChange}
                                    readOnly={!editable}
                                    staticRender={staticRender}
                                    placeholder="Rate"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col p-[0.45%]">
                        <label className={`text-center text-[0.85em] ${SECTION_LABEL_CLASS}`}>Basis of Booking</label>
                        <div className="flex flex-1 flex-col items-center justify-center gap-y-1 text-[0.8em]">
                            {basisOfBookingOptions.map(option =>
                                editable ? (
                                    <label key={option} className="inline-flex items-center gap-1 whitespace-nowrap">
                                        <input
                                            type="radio"
                                            name={`basisOfBooking-${basisCopy ? "copy" : "primary"}`}
                                            data-field-name="basisOfBooking"
                                            value={option}
                                            checked={(formData.basisOfBooking || "To Pay") === option}
                                            onChange={onChange}
                                        />
                                        {option}
                                    </label>
                                ) : (
                                    <span key={option} className="inline-flex items-center gap-1 whitespace-nowrap">
                                        <span>{(formData.basisOfBooking || "To Pay") === option ? "◉" : "○"}</span>
                                        {option}
                                    </span>
                                ),
                            )}
                        </div>
                    </div>
                </div>

                {/* Amount column */}
                <div className="grid min-w-0 grid-rows-[auto_repeat(8,minmax(0,1fr))]">
                    <div className={`flex items-center justify-center border-b border-black text-[0.85em] ${SECTION_LABEL_CLASS}`}>
                        Amount
                    </div>
                    {[
                        ["Freight", "freight"],
                        ["Labour", "labour"],
                        ["GST Charges", "gstCharges"],
                        ["Bilty Charges", "biltyCharges"],
                        ["Kanta", "kanta"],
                        ["Grand Total", "grandTotal"],
                        ["Advance", "advance"],
                        ["Balance Amount", "balanceAmt"],
                    ].map(([label, name], index) => (
                        <div
                            key={name}
                            className={`grid min-w-0 grid-cols-[0.9fr_1.1fr] ${
                                index < 7 ? "border-b border-black" : ""
                            }`}
                        >
                            <div className={`flex items-center border-r border-black px-[0.35em] text-[0.94em] leading-tight ${FIELD_LABEL_CLASS}`}>
                                {label}
                            </div>
                            <TextInput
                                name={name}
                                value={
                                    basisCopy
                                        ? name === "freight"
                                            ? formData.basisOfBooking
                                            : ""
                                        : (formData[name as keyof BiltyFormState] as string)
                                }
                                onChange={onChange}
                                readOnly={
                                    !editable ||
                                    (name === "freight" && freightReadOnly) ||
                                    name === "grandTotal" ||
                                    name === "balanceAmt"
                                }
                                staticRender={staticRender}
                                align="right"
                                inputMode="decimal"
                                className="border-0"
                                tiers={NARROW_SINGLE_LINE_TIERS}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Declared value / Driver */}
            <PositionedBox style={boxStyle(0.747, 0.05, 0.445, 0.038)} label="Declared Value" className="justify-center">
                <TextInput
                    name="declaredValue"
                    value={formData.declaredValue}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Declared Value"
                    tiers={GENEROUS_SINGLE_LINE_TIERS}
                />
            </PositionedBox>

            <PositionedBox style={boxStyle(0.747, 0.505, 0.445, 0.038)} label="Driver" className="justify-center">
                <TextInput
                    name="driver"
                    value={formData.driver}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Driver"
                    tiers={GENEROUS_SINGLE_LINE_TIERS}
                />
            </PositionedBox>

            {/* Signature / Remarks */}
            <PositionedBox style={boxStyle(0.795, 0.05, 0.9, 0.093)} label="Signature or Remarks" labelClassName={SECTION_LABEL_CLASS}>
                <div className="relative flex min-h-0 flex-1 flex-col justify-center">
                    <TextAreaField
                        className="pr-[52%]"
                        name="remarks"
                        density="normal"
                        centerWhenShort
                        value={formData.remarks}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        rows={3}
                    />
                    <div className="absolute inset-y-0 right-[25%] flex w-[27%] flex-col justify-end border-l border-black bg-white px-[0.35em] pb-[0.3em]">
                        <div className="border-b border-black" />
                        <span className={`mt-[0.15em] block text-center text-[0.95em] leading-tight ${FIELD_LABEL_CLASS}`}>
                            Signature
                        </span>
                    </div>
                    <div className="absolute inset-y-0 right-0 flex w-[25%] flex-col justify-center border-l border-black bg-white pl-[0.35em]">
                        <label className={`mb-[0.2em] block text-[0.85em] leading-tight ${FIELD_LABEL_CLASS}`}>Booking Clerk</label>
                        <TextInput
                            className="h-[1.8em]"
                            name="bookingClerk"
                            value={formData.bookingClerk}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Booking Clerk"
                            tiers={GENEROUS_SINGLE_LINE_TIERS}
                        />
                    </div>
                </div>
            </PositionedBox>

        </div>
    );
};

export default BiltyDocument;

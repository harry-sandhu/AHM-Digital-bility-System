import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { BiltyFormState } from "../types/biltyForm";
import AutoSuggest from "./AutoSuggest";
import type { Suggestion } from "../utils/suggest";

const pct = (value: number) => `${value * 100}%`;

/** Extra header height (phone line + larger two-line bank/GST block) pushes every box below it down by this much. */
const HEADER_SHIFT = 0.047;

const boxStyle = (top: number, left: number, width: number, height: number): CSSProperties => ({
    top: pct(top + HEADER_SHIFT),
    left: pct(left),
    width: pct(width),
    height: pct(height),
});

const normalizeDisplayValue = (value: unknown) => {
    if (Array.isArray(value)) return value.join(", ");
    if (value === null || value === undefined) return "";
    return String(value);
};

const sizeForLength = (length: number, tiers: Array<[number, string]>): string => {
    for (const [maxLen, size] of tiers) {
        if (length <= maxLen) return size;
    }
    return tiers[tiers.length - 1][1];
};

const tieredFontSize = (value: unknown, tiers: Array<[number, string]>): string =>
    sizeForLength(normalizeDisplayValue(value).trim().length, tiers);

/**
 * For a group of fields that sit on the same horizontal line (e.g. Lorry No.
 * + Phone No., or the Actual Wt./Charged Wt./Rate trio): rather than each
 * field picking its own size from its own content length, the whole group
 * shares ONE size, driven by whichever member's content is longest. Short
 * siblings shrink to match their longest row-mate instead of looking
 * oversized next to it.
 */
const sharedRowFontSize = (values: unknown[], tiers: Array<[number, string]>): string => {
    const longest = values.reduce<number>(
        (max, value) => Math.max(max, normalizeDisplayValue(value).trim().length),
        0
    );
    return sizeForLength(longest, tiers);
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
        [4, "1.5em"],
        [8, "1.35em"],
        [14, "1.2em"],
        [24, "1.05em"],
    ],
    compact: [
        [6, "1.35em"],
        [10, "1.2em"],
        [16, "1.1em"],
        [24, "1em"],
    ],
    normal: [
        [10, "1.7em"],
        [20, "1.5em"],
        [40, "1.3em"],
        [70, "1.1em"],
        [120, "1em"],
    ],
    wide: [
        [20, "2.1em"],
        [45, "1.8em"],
        [80, "1.5em"],
        [130, "1.25em"],
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
            <label className={`block shrink-0 text-[1.6em] leading-tight ${labelClassName || FIELD_LABEL_CLASS}`}>
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
                className="h-full min-h-0 w-full min-w-0 overflow-hidden border-0 bg-transparent p-0 text-inherit leading-tight outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 print:ring-0"
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

const DateInput: React.FC<
    InputHTMLAttributes<HTMLInputElement> & { bordered?: boolean; staticRender?: boolean; compact?: boolean }
> = ({ className = "", bordered = false, staticRender = false, compact = false, value, style, ...props }) => {
    const fontSizeStyle: CSSProperties = compact ? { fontSize: "0.78em", ...style } : { ...style };

    if (staticRender) {
        return (
            <div
                className={`relative flex w-full min-w-0 items-center overflow-hidden ${bordered ? "border border-black" : "border-0"} bg-transparent pl-[0.2em] pr-[0.2em] text-[1.5em] leading-tight text-black ${className}`}
                // Printed/static dates have no picker icon to make room for, so
                // they can match the size of every other value.
                style={{ ...fontSizeStyle, fontSize: "clamp(9px, 1.64cqw, 18px)" }}
                title={formatStaticDate(value)}
            >
                <span className="min-w-0 max-w-full overflow-hidden whitespace-nowrap">
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
                className={`w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${bordered ? "border border-black" : "border-0"} bg-transparent pl-[0.2em] pr-[0.2em] text-[1.5em] leading-tight outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 print:ring-0 ${className}`}
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
    /** false = never break inside a word; shrink the text instead (narrow columns like From/To). */
    breakWords?: boolean;
};

const estimateRows = (value: unknown, maxRows: number, charsPerLine = 22): number => {
    const length = normalizeDisplayValue(value).trim().length;
    if (!length) return Math.min(2, maxRows);
    const needed = Math.ceil(length / charsPerLine) + 1;
    return Math.min(Math.max(needed, 1), maxRows);
};

/** Smallest the text may shrink to (fraction of its normal size) before it is allowed to clip. */
const MIN_FIT_SCALE = 0.4;

const TextAreaField: React.FC<TextAreaFieldProps> = ({
    className = "",
    bordered = false,
    style,
    staticRender = false,
    density = "normal",
    centerWhenShort = false,
    breakWords = true,
    value,
    ...props
}) => {
    const autoFontSize = tieredFontSize(value, MULTILINE_TIERS[density]);
    const baseFontSize = String(style?.fontSize ?? autoFontSize);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Long text shrinks to fit its box instead of being cropped: the font
    // size is `base * --fit`, and --fit drops from 1 until nothing overflows
    // (or MIN_FIT_SCALE is reached). Re-runs when the text or the box size
    // changes (the base size itself scales with the page width).
    const text = normalizeDisplayValue(value);
    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const overflows = () => {
            const target = staticRender ? wrapper : textareaRef.current;
            return target
                ? target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth
                : false;
        };

        const fit = () => {
            let scale = 1;
            wrapper.style.setProperty("--fit", "1");
            while (overflows() && scale > MIN_FIT_SCALE) {
                scale = Math.round((scale - 0.04) * 100) / 100;
                wrapper.style.setProperty("--fit", String(scale));
            }
        };

        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(wrapper);
        // Web fonts load after first paint and change the text's width.
        void document.fonts?.ready.then(fit);
        return () => observer.disconnect();
    }, [text, staticRender, baseFontSize]);

    const sharedStyle: CSSProperties = {
        minHeight: 0,
        overflowWrap: breakWords ? "anywhere" : "normal",
        ...style,
        fontSize: `calc(var(--fit, 1) * ${baseFontSize})`,
    };

    if (staticRender) {
        return (
            <div
                ref={wrapperRef}
                className={`w-full min-w-0 flex-1 overflow-hidden ${bordered ? "border border-black" : "border-0"} bg-transparent px-[0.2em] py-[0.1em] leading-tight text-black ${className}`}
                style={sharedStyle}
                title={text}
            >
                <span className={`block min-w-0 max-w-full whitespace-pre-wrap ${breakWords ? "break-words" : "break-normal"}`}>
                    {text || "\u00A0"}
                </span>
            </div>
        );
    }

    if (centerWhenShort) {
        const effectiveRows = estimateRows(value, Number(props.rows) || 4);
        return (
            <div
                ref={wrapperRef}
                className={`flex w-full min-w-0 overflow-hidden ${bordered ? "border border-black" : "border-0"} bg-transparent ${className}`}
                style={sharedStyle}
            >
                <textarea
                    {...props}
                    ref={textareaRef}
                    rows={effectiveRows}
                    value={value}
                    className="min-h-0 w-full min-w-0 resize-none border-0 bg-transparent px-[0.2em] py-[0.1em] text-inherit leading-tight outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 print:ring-0"
                />
            </div>
        );
    }

    return (
        <div
            ref={wrapperRef}
            className={`flex w-full min-w-0 flex-1 overflow-hidden ${bordered ? "border border-black" : "border-0"} bg-transparent ${className}`}
            style={sharedStyle}
        >
            <textarea
                {...props}
                ref={textareaRef}
                value={value}
                style={{ overflowWrap: breakWords ? "anywhere" : "normal" }}
                className="h-full min-h-0 w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent px-[0.2em] py-[0.1em] text-inherit leading-tight outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 print:ring-0"
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
    onSelectConsignor?: (address: string, gstin: string) => void;
    onSelectConsignee?: (address: string, gstin: string) => void;
    onSelectPacking?: (value: string) => void;
    onSelectDelivery?: (value: string) => void;
    suggestions?: {
        consignor: Suggestion[];
        consignee: Suggestion[];
        packing: Suggestion[];
        delivery: Suggestion[];
    };
};

const BiltyDocument: React.FC<BiltyDocumentProps> = ({
    formData,
    onChange,
    freightReadOnly = false,
    basisCopy = false,
    className = "",
    documentRef,
    fontSize = "clamp(6px, 1cqw, 13px)",
    onSelectConsignor,
    onSelectConsignee,
    onSelectPacking,
    onSelectDelivery,
    suggestions,
}) => {
    const editable = Boolean(onChange);
    const staticRender = !editable;
    const gstPaidByOptions = ["Consignor", "Consignee", "Transporter"] as const;
    const basisOfBookingOptions = ["To Pay", "PAID", "T.B.B"] as const;

    // Every value field renders at one fixed, uniform size instead of
    // auto-tiering per field/group by content length. Boxes are sized to fit
    // typical real-world content at this size; extremely long outliers (far
    // past what the field is meant for) may clip rather than auto-shrink.
    const UNIFORM_VALUE_SIZE = "clamp(9px, 1.64cqw, 18px)";
    const lorryPhoneSize = UNIFORM_VALUE_SIZE;
    const consignmentInvoiceSize = UNIFORM_VALUE_SIZE;
    const partyAddressSize = UNIFORM_VALUE_SIZE;
    const partyGstinSize = UNIFORM_VALUE_SIZE;
    const actualChargedRateSize = UNIFORM_VALUE_SIZE;
    const declaredValueDriverSize = UNIFORM_VALUE_SIZE;
    // Description sits alone in the tallest box in the document (no sibling
    // row to split height with), so short entries need a much bigger jump
    // than the shared "wide" tier gives everyone else, or they float lost
    // in all that vertical room.
    const descriptionSize = UNIFORM_VALUE_SIZE;

    return (
        <div
            ref={documentRef}
            className={`relative mx-auto aspect-[210/297] w-full border-2 border-black bg-white text-black shadow-sm ${className}`}
            style={{ fontSize }}
        >
            {/* Header */}
            <div
                className="absolute right-[2%] rounded-sm border border-black px-[0.5em] py-[0.15em] font-bold uppercase tracking-[0.08em] text-black"
                style={{ top: pct(0.014), fontSize: "clamp(7px, 0.85cqw, 12px)" }}
            >
                {basisCopy ? "Duplicate" : "Original"}
            </div>
            <div
                className="absolute w-full text-center font-extrabold leading-none text-red-800"
                style={{ top: pct(0.018), fontSize: "clamp(22px, 2.4cqw, 38px)" }}
            >
                AHM TRANSPORT SERVICE
            </div>
            <div
                className="absolute w-full px-[5%] text-center text-black"
                style={{ top: pct(0.058), fontSize: "clamp(11px, 1.3cqw, 18px)" }}
            >
                Rampur-Bilaspur Road, Vill. &amp; Post Bhot - 244901 (Uttar Pradesh)
            </div>
            <div
                className="absolute w-full px-[5%] text-center font-semibold text-black"
                style={{ top: pct(0.081), fontSize: "clamp(10px, 1.3cqw, 18px)" }}
            >
                M.: 96909-53645, 8077931418
            </div>
            <div
                className="absolute w-full px-[5%] text-center leading-tight text-black"
                style={{ top: pct(0.104), fontSize: "clamp(8px, 1.2cqw, 16px)" }}
            >
                GSTIN: 09CPGPS1323P1ZD &nbsp;|&nbsp; PAN No: CPGPS1323P &nbsp;|&nbsp; Email: ahmtptservice@gmail.com
            </div>
            <div
                className="absolute w-full px-[5%] text-center leading-tight text-black"
                style={{ top: pct(0.127), fontSize: "clamp(8px, 1.2cqw, 16px)" }}
            >
                A/c No: 918020094902004 &nbsp;|&nbsp; I.F.S. Code: UTIB0000795 &nbsp;|&nbsp; Branch: Axis Bank, Rampur
            </div>
            <div className="absolute left-[5%] w-[90%] border-b border-black" style={{ top: pct(0.103 + HEADER_SHIFT) }} />

            {/* Lorry / Invoice / Phone */}
            <PositionedBox style={boxStyle(0.112, 0.05, 0.22, 0.052)} label="Lorry No." className="justify-center">
                <TextInput
                    name="lorryNo"
                    value={formData.lorryNo}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Lorry Number"
                    autoCapitalize="characters"
                    tiers={GENEROUS_SINGLE_LINE_TIERS}
                    style={{ fontSize: lorryPhoneSize }}
                />
            </PositionedBox>

            <PositionedBox style={boxStyle(0.112, 0.27, 0.40, 0.052)}>
                <div className="flex h-full items-center justify-center text-center text-[1.9em] font-semibold leading-tight">
                    AT OWNER&apos;S RISK / FREIGHT BROKER
                </div>
            </PositionedBox>

            <PositionedBox style={boxStyle(0.112, 0.67, 0.28, 0.052)} label="Consignee Phone No." className="justify-center">
                <TextInput
                    name="phoneNo"
                    value={formData.phoneNo}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Phone Number"
                    inputMode="tel"
                    tiers={GENEROUS_SINGLE_LINE_TIERS}
                    style={{ fontSize: lorryPhoneSize }}
                />
            </PositionedBox>

            {/* Delivery 4:1 Insurance */}
            <PositionedBox style={boxStyle(0.174, 0.05, 0.58, 0.095)} label="Delivery Address">
                <AutoSuggest
                    className="flex min-h-0 flex-1 flex-col"
                    query={formData.deliveryAddress}
                    suggestions={editable && onSelectDelivery ? suggestions?.delivery ?? [] : []}
                    onPick={(suggestion) => onSelectDelivery?.(suggestion.text)}
                >
                    <TextAreaField
                        name="deliveryAddress"
                        density="wide"
                        value={formData.deliveryAddress}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Delivery Address"
                        rows={4}
                        style={{ fontSize: UNIFORM_VALUE_SIZE }}
                    />
                </AutoSuggest>
            </PositionedBox>

            <PositionedBox style={boxStyle(0.174, 0.64, 0.31, 0.095)} label="Insurance" labelClassName={SECTION_LABEL_CLASS}>
                <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_auto] content-center gap-[0.55em]">
                    <TextInput
                        name="insuranceCompany"
                        value={formData.insuranceCompany}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Company"
                        tiers={GENEROUS_SINGLE_LINE_TIERS}
                        style={{ fontSize: UNIFORM_VALUE_SIZE }}
                    />
                    <div className="grid min-h-0 grid-cols-2 gap-[0.3em]">
                        <TextInput
                            name="insurancePolicyNo"
                            value={formData.insurancePolicyNo}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Policy No."
                            tiers={DEFAULT_SINGLE_LINE_TIERS}
                            style={{ fontSize: UNIFORM_VALUE_SIZE }}
                        />
                        <TextInput
                            name="insuranceCertNo"
                            value={formData.insuranceCertNo}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="DEC/CERT No."
                            tiers={DEFAULT_SINGLE_LINE_TIERS}
                            style={{ fontSize: UNIFORM_VALUE_SIZE }}
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
                            style={{ fontSize: UNIFORM_VALUE_SIZE }}
                        />
                        <TextInput
                            name="insuranceAmount"
                            value={formData.insuranceAmount}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Amount"
                            align="right"
                            tiers={DEFAULT_SINGLE_LINE_TIERS}
                            inputMode="decimal"
                            style={{ fontSize: UNIFORM_VALUE_SIZE }}
                        />
                    </div>
                </div>
            </PositionedBox>

            {/* Consignment Note */}
            <PositionedBox style={boxStyle(0.279, 0.05, 0.27, 0.070)} label="Consignment Note No." labelClassName={SECTION_LABEL_CLASS}>
                <div className="grid min-h-0 flex-1 grid-cols-[0.42fr_0.58fr] gap-1">
                    <TextInput
                        name="consignmentNo"
                        value={formData.consignmentNo}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Note No."
                        style={{ fontSize: consignmentInvoiceSize }}
                    />
                    <DateInput
                        name="biltyDate"
                        type="date"
                        value={formData.biltyDate ?? ""}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        compact
                        style={{ fontSize: "clamp(9px, 1.4cqw, 15px)" }}
                    />
                </div>
            </PositionedBox>

            <PositionedBox style={boxStyle(0.279, 0.32, 0.33, 0.070)} label="Invoice No. & Date" labelClassName={SECTION_LABEL_CLASS}>
                <div className="grid min-h-0 flex-1 grid-cols-[1fr_0.55fr] gap-1">
                    <TextInput
                        name="invoiceNoDate"
                        value={formData.invoiceNoDate}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        placeholder="Invoice Number"
                        style={{ fontSize: consignmentInvoiceSize }}
                    />
                    <DateInput
                        name="invoiceDate"
                        type="date"
                        value={formData.invoiceDate ?? ""}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        compact
                        style={{ fontSize: "clamp(9px, 1.4cqw, 15px)" }}
                    />
                </div>
            </PositionedBox>

            <PositionedBox style={boxStyle(0.279, 0.65, 0.30, 0.070)} label="GST Paid By" className="justify-start" labelClassName={SECTION_LABEL_CLASS}>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 leading-tight" style={{ fontSize: UNIFORM_VALUE_SIZE }}>
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
                style={{ ...boxStyle(0.359, 0.05, 0.9, 0.115), gridTemplateColumns: "1.35fr 1.35fr 0.45fr 0.45fr", gridTemplateRows: "minmax(0, 1fr)" }}
            >
                <div className="relative flex min-w-0 flex-col border-r border-black p-[0.35%]">
                    <label className={`block shrink-0 text-[1.6em] leading-tight ${SECTION_LABEL_CLASS}`}>
                        Consignor&apos;s Name &amp; Address
                    </label>
                    <div className="flex min-h-0 flex-1 flex-col justify-start">
                        <AutoSuggest
                            className="flex min-h-0 flex-1 flex-col"
                            query={formData.consignorAddress}
                            suggestions={editable && onSelectConsignor ? suggestions?.consignor ?? [] : []}
                            onPick={(suggestion) => onSelectConsignor?.(suggestion.text, suggestion.sub || "")}
                        >
                            <TextAreaField
                                name="consignorAddress"
                                density="wide"
                                value={formData.consignorAddress}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                rows={4}
                                style={{ fontSize: partyAddressSize }}
                            />
                        </AutoSuggest>
                        <TextInput
                            name="consignorGstin"
                            value={formData.consignorGstin}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="GSTIN"
                            autoCapitalize="characters"
                            style={{ fontSize: partyGstinSize }}
                        />
                    </div>
                </div>

                <div className="relative flex min-w-0 flex-col border-r border-black p-[0.35%]">
                    <label className={`block shrink-0 text-[1.6em] leading-tight ${SECTION_LABEL_CLASS}`}>
                        Consignee&apos;s Name &amp; Address
                    </label>
                    <div className="flex min-h-0 flex-1 flex-col justify-start">
                        <AutoSuggest
                            className="flex min-h-0 flex-1 flex-col"
                            query={formData.consigneeAddress}
                            suggestions={editable && onSelectConsignee ? suggestions?.consignee ?? [] : []}
                            onPick={(suggestion) => onSelectConsignee?.(suggestion.text, suggestion.sub || "")}
                        >
                            <TextAreaField
                                name="consigneeAddress"
                                density="wide"
                                value={formData.consigneeAddress}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                rows={4}
                                style={{ fontSize: partyAddressSize }}
                            />
                        </AutoSuggest>
                        <TextInput
                            name="consigneeGstin"
                            value={formData.consigneeGstin}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="GSTIN"
                            autoCapitalize="characters"
                            style={{ fontSize: partyGstinSize }}
                        />
                    </div>
                </div>

                <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                    <label className={`text-center text-[1.6em] leading-tight ${FIELD_LABEL_CLASS}`}>From</label>
                    <div className="flex min-h-0 flex-1 flex-col justify-start">
                        <TextAreaField
                            name="from"
                            density="normal"
                            breakWords={false}
                            value={formData.from}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            rows={5}
                            style={{ fontSize: partyAddressSize }}
                        />
                    </div>
                </div>

                <div className="flex min-w-0 flex-col p-[0.35%]">
                    <label className={`text-center text-[1.6em] leading-tight ${FIELD_LABEL_CLASS}`}>To</label>
                    <div className="flex min-h-0 flex-1 flex-col justify-start">
                        <TextAreaField
                            name="to"
                            density="normal"
                            breakWords={false}
                            value={formData.to}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            rows={5}
                            style={{ fontSize: partyAddressSize }}
                        />
                    </div>
                </div>
            </div>

            {/* Main consignment / weights / amount table */}
            <div
                className="absolute grid overflow-hidden border border-black bg-white"
                style={{
                    ...boxStyle(0.484, 0.05, 0.9, 0.238),
                    gridTemplateColumns: "1.25fr 1.7fr 2.15fr 1.45fr",
                    gridTemplateRows: "minmax(0, 1fr)",
                }}
            >
                {/* Method of packing + number of packages */}
                <div className="grid min-w-0 grid-rows-[minmax(0,1.5fr)_minmax(0,0.5fr)] border-r border-black">
                    <div className="flex min-w-0 flex-col border-b border-black p-[0.45%]">
                        <label className={`min-h-[2.5em] leading-tight text-center text-[1.6em] ${SECTION_LABEL_CLASS}`}>Method Of Packing</label>
                        <div className="flex min-h-0 flex-1 flex-col justify-start">
                            <AutoSuggest
                                className="flex min-h-0 flex-1 flex-col"
                                query={formData.methodOfPacking}
                                suggestions={editable && onSelectPacking ? suggestions?.packing ?? [] : []}
                                onPick={(suggestion) => onSelectPacking?.(suggestion.text)}
                            >
                                <TextAreaField
                                    name="methodOfPacking"
                                    density="normal"
                                    value={formData.methodOfPacking}
                                    onChange={onChange}
                                    readOnly={!editable}
                                    staticRender={staticRender}
                                    placeholder="Method Of Packing"
                                    rows={3}
                                    style={{ fontSize: UNIFORM_VALUE_SIZE }}
                                />
                            </AutoSuggest>
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-col p-[0.45%]">
                        <label className={`text-center text-[1.6em] ${SECTION_LABEL_CLASS}`}>No. of Packages</label>
                        <div className="flex min-h-0 flex-1 flex-col justify-start">
                            <TextAreaField
                                name="packages"
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                                density="wide"
                                value={formData.packages}
                                onChange={onChange}
                                readOnly={!editable}
                                staticRender={staticRender}
                                placeholder="No. of Packages"
                                rows={3}
                                style={{ fontSize: UNIFORM_VALUE_SIZE }}
                            />
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div className="flex min-w-0 flex-col border-r border-black p-[0.45%]">
                    <label className={`min-h-[2.5em] leading-tight text-center text-[1.6em] ${SECTION_LABEL_CLASS}`}>Description</label>
                    <div className="flex min-h-0 flex-1 flex-col justify-start">
                        <TextAreaField
                            name="description"
                            density="wide"
                            value={formData.description}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Description"
                            rows={8}
                            style={{ fontSize: descriptionSize }}
                        />
                    </div>
                </div>

                {/* Weight/Rate upper + Basis of Booking lower */}
                <div className="grid min-w-0 grid-rows-[minmax(0,1.1fr)_minmax(0,0.9fr)] border-r border-black">
                    <div className="grid min-w-0 grid-cols-3 border-b border-black">
                        <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                            <label className={`min-h-[2.5em] leading-tight text-center text-[1.6em] ${SECTION_LABEL_CLASS}`}>Actual Wt.</label>
                            <div className="flex min-h-0 flex-1 flex-col justify-start">
                                <TextAreaField
                                    name="actualWt"
                                    density="narrow"
                                    value={formData.actualWt}
                                    onChange={onChange}
                                    readOnly={!editable}
                                    staticRender={staticRender}
                                    placeholder="Actual"
                                    rows={3}
                                    style={{ fontSize: actualChargedRateSize }}
                                />
                            </div>
                        </div>
                        <div className="flex min-w-0 flex-col border-r border-black p-[0.35%]">
                            <label className={`min-h-[2.5em] leading-tight text-center text-[1.6em] ${SECTION_LABEL_CLASS}`}>Charged Wt.</label>
                            <div className="flex min-h-0 flex-1 flex-col justify-start">
                                <TextAreaField
                                    name="chargedWt"
                                    density="narrow"
                                    value={formData.chargedWt}
                                    onChange={onChange}
                                    readOnly={!editable}
                                    staticRender={staticRender}
                                    placeholder="Charged"
                                    rows={3}
                                    style={{ fontSize: actualChargedRateSize }}
                                />
                            </div>
                        </div>
                        <div className="flex min-w-0 flex-col p-[0.35%]">
                            <label className={`min-h-[2.5em] leading-tight text-center text-[1.6em] ${SECTION_LABEL_CLASS}`}>Rate</label>
                            <div className="flex min-h-0 flex-1 flex-col justify-start">
                                <TextAreaField
                                    name="rate"
                                    density="narrow"
                                    value={formData.rate}
                                    onChange={onChange}
                                    readOnly={!editable}
                                    staticRender={staticRender}
                                    placeholder="Rate"
                                    rows={3}
                                    style={{ fontSize: actualChargedRateSize }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col p-[0.45%]">
                        <label className={`text-center text-[1.6em] ${SECTION_LABEL_CLASS}`}>Basis of Booking</label>
                        <div className="flex flex-1 flex-col items-center justify-center gap-y-1" style={{ fontSize: "clamp(8px, 1.55cqw, 17px)" }}>
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
                    <div className={`flex items-center justify-center border-b border-black text-[1.6em] ${SECTION_LABEL_CLASS}`}>
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
                            <div className={`flex items-center border-r border-black px-[0.35em] leading-tight ${FIELD_LABEL_CLASS}`} style={{ fontSize: "clamp(7px, 1.27cqw, 14px)" }}>
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
                                tiers={DEFAULT_SINGLE_LINE_TIERS}
                                style={{ fontSize: UNIFORM_VALUE_SIZE }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Declared value / Driver */}
            <PositionedBox style={boxStyle(0.732, 0.05, 0.445, 0.047)} label="Declared Value" className="justify-center">
                <TextInput
                    name="declaredValue"
                    value={formData.declaredValue}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Declared Value"
                    tiers={GENEROUS_SINGLE_LINE_TIERS}
                    style={{ fontSize: declaredValueDriverSize }}
                />
            </PositionedBox>

            <PositionedBox style={boxStyle(0.732, 0.505, 0.445, 0.047)} label="Driver" className="justify-center">
                <TextInput
                    name="driver"
                    value={formData.driver}
                    onChange={onChange}
                    readOnly={!editable}
                    staticRender={staticRender}
                    placeholder="Driver"
                    tiers={GENEROUS_SINGLE_LINE_TIERS}
                    style={{ fontSize: declaredValueDriverSize }}
                />
            </PositionedBox>

            {/* Signature / Remarks */}
            <PositionedBox style={boxStyle(0.789, 0.05, 0.9, 0.091)} label="Signature or Remarks" labelClassName={SECTION_LABEL_CLASS}>
                <div className="relative flex min-h-0 flex-1 flex-col justify-start">
                    <TextAreaField
                        className="pr-[52%]"
                        name="remarks"
                        density="normal"
                        value={formData.remarks}
                        onChange={onChange}
                        readOnly={!editable}
                        staticRender={staticRender}
                        rows={3}
                        style={{ fontSize: UNIFORM_VALUE_SIZE }}
                    />
                    <div className="absolute inset-y-0 right-[25%] flex w-[27%] flex-col justify-end border-l border-black bg-white px-[0.35em] pb-[0.3em]">
                        <div className="border-b border-black" />
                        <span className={`mt-[0.15em] block text-center text-[0.95em] leading-tight ${FIELD_LABEL_CLASS}`}>
                            Signature
                        </span>
                    </div>
                    <div className="absolute inset-y-0 right-0 flex w-[25%] flex-col justify-center border-l border-black bg-white pl-[0.35em]">
                        <label className={`mb-[0.2em] block text-[1.6em] leading-tight ${FIELD_LABEL_CLASS}`}>Booking Clerk</label>
                        <TextInput
                            className="h-[1.8em]"
                            name="bookingClerk"
                            value={formData.bookingClerk}
                            onChange={onChange}
                            readOnly={!editable}
                            staticRender={staticRender}
                            placeholder="Booking Clerk"
                            tiers={GENEROUS_SINGLE_LINE_TIERS}
                            style={{ fontSize: UNIFORM_VALUE_SIZE }}
                        />
                    </div>
                </div>
            </PositionedBox>

        </div>
    );
};

export default BiltyDocument;

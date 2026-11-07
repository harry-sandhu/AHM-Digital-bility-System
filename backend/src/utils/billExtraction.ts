export interface ExtractedBillFields {
  invoiceNoDate?: string;
  invoiceDate?: string;
  consignorAddress?: string;
  consignorGstin?: string;
  consigneeAddress?: string;
  consigneeGstin?: string;
  packages?: string;
  description?: string;
  actualWt?: string;
  amount?: string;
  declaredValue?: string;
  freight?: string;
}

const GSTIN_REGEX = /\b\d{2}[A-Za-z]{5}\d{4}[A-Za-z]\d[Zz][A-Za-z\d]\b/g;
const DATE_REGEX = /\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/;
const AMOUNT_REGEX = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i;
const PLAIN_NUMBER_REGEX = /([\d,]+(?:\.\d{1,2})?)/;

const cleanLine = (line: string) => line.replace(/\s+/g, " ").trim();

const splitLines = (text: string) => text.split(/\r?\n/).map(cleanLine).filter(Boolean);

// Looks for a label (e.g. "Invoice No") and returns whatever follows it on the
// same line, or failing that, the next non-label line below it. Bills have no
// fixed layout, so this is a best-effort heuristic, not a guarantee.
const findAfterLabel = (
  lines: string[],
  labelPatterns: RegExp[],
  maxLookahead = 2
): string | undefined => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of labelPatterns) {
      const match = line.match(pattern);
      if (!match || match.index === undefined) continue;

      const afterMatch = line
        .slice(match.index + match[0].length)
        .replace(/^[:\-–]\s*/, "")
        .trim();
      if (afterMatch) return afterMatch;

      for (let lookahead = 1; lookahead <= maxLookahead; lookahead++) {
        const nextLine = lines[i + lookahead];
        if (nextLine && !labelPatterns.some((p) => p.test(nextLine))) {
          return nextLine;
        }
      }
    }
  }

  return undefined;
};

const findAllGstins = (text: string): string[] => {
  const matches = text.match(GSTIN_REGEX) ?? [];
  return [...new Set(matches.map((match) => match.toUpperCase()))];
};

export const extractBillFields = (rawText: string): ExtractedBillFields => {
  const lines = splitLines(rawText);
  const extracted: ExtractedBillFields = {};

  const gstins = findAllGstins(rawText);
  if (gstins[0]) extracted.consignorGstin = gstins[0];
  if (gstins[1]) extracted.consigneeGstin = gstins[1];

  const invoiceNo = findAfterLabel(lines, [/invoice\s*(no\.?|number|#)/i, /\bbill\s*(no\.?|number)\b/i]);
  if (invoiceNo) extracted.invoiceNoDate = invoiceNo;

  const invoiceDateLine = findAfterLabel(lines, [/invoice\s*date/i, /\bbill\s*date\b/i, /\bdated\b/i]);
  const invoiceDateMatch = invoiceDateLine?.match(DATE_REGEX);
  if (invoiceDateMatch) extracted.invoiceDate = invoiceDateMatch[1];

  const consignorAddress = findAfterLabel(lines, [
    /\bconsignor\b/i,
    /\bseller\b/i,
    /\bsold\s*by\b/i,
    /\bbilled\s*by\b/i,
  ]);
  if (consignorAddress) extracted.consignorAddress = consignorAddress;

  const consigneeAddress = findAfterLabel(lines, [
    /\bconsignee\b/i,
    /\bship(ped)?\s*to\b/i,
    /\bbill(ed)?\s*to\b/i,
    /\bbuyer\b/i,
  ]);
  if (consigneeAddress) extracted.consigneeAddress = consigneeAddress;

  const packages = findAfterLabel(lines, [/no\.?\s*of\s*packages?/i, /\bpackages?\b/i, /\bpkgs?\b/i, /\bqty\b/i]);
  if (packages) extracted.packages = packages;

  const description = findAfterLabel(lines, [
    /description\s*of\s*goods/i,
    /\bparticulars\b/i,
    /item\s*description/i,
  ]);
  if (description) extracted.description = description;

  const weight = findAfterLabel(lines, [/net\s*weight/i, /gross\s*weight/i, /\bweight\b/i, /\bwt\.?\b/i]);
  if (weight) extracted.actualWt = weight;

  const taxableLine = findAfterLabel(lines, [/taxable\s*value/i, /\btaxable\s*amount\b/i]);
  const amountMatch = taxableLine?.match(AMOUNT_REGEX) ?? taxableLine?.match(PLAIN_NUMBER_REGEX);
  if (amountMatch) extracted.amount = amountMatch[1].replace(/,/g, "");

  const totalLine = findAfterLabel(lines, [/grand\s*total/i, /total\s*amount/i, /invoice\s*value/i]);
  const totalMatch = totalLine?.match(AMOUNT_REGEX) ?? totalLine?.match(PLAIN_NUMBER_REGEX);
  if (totalMatch) extracted.declaredValue = totalMatch[1].replace(/,/g, "");

  const freightLine = findAfterLabel(lines, [/freight/i, /transport\s*charges?/i]);
  const freightMatch = freightLine?.match(AMOUNT_REGEX) ?? freightLine?.match(PLAIN_NUMBER_REGEX);
  if (freightMatch) extracted.freight = freightMatch[1].replace(/,/g, "");

  return extracted;
};

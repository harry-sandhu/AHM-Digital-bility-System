export type BiltyFormState = {
  lorryNo: string;
  invoiceNoDate: string;
  invoiceDate: string;
  deliveryAddress: string;
  phoneNo: string;
  insuranceCompany: string;
  insurancePolicyNo: string;
  insuranceDate: string;
  insuranceCertNo: string;
  insuranceAmount: string;
  biltyNumber: string;
  gstPaidBy: string;
  basisOfBooking: string;
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
  kanta: string;
  grandTotal: string;
  advance: string;
  balanceAmt: string;
  declaredValue: string;
  driver: string;
  remarks: string;
  bookingClerk: string;
};

export const initialBiltyFormData: BiltyFormState = {
  lorryNo: "",
  invoiceNoDate: "",
  invoiceDate: "",
  deliveryAddress: "",
  phoneNo: "",
  insuranceCompany: "",
  insurancePolicyNo: "",
  insuranceDate: "",
  insuranceCertNo: "",
  insuranceAmount: "",
  biltyNumber: "",
  gstPaidBy: "",
  basisOfBooking: "To Pay",
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
  kanta: "",
  grandTotal: "0",
  advance: "",
  balanceAmt: "0",
  declaredValue: "",
  driver: "",
  remarks: "",
  bookingClerk: "",
};

const parseAmount = (value: string) => {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

export const calculateBiltyTotals = (formData: BiltyFormState): BiltyFormState => {
  const grandTotal =
    parseAmount(formData.freight) +
    parseAmount(formData.labour) +
    parseAmount(formData.gstCharges) +
    parseAmount(formData.biltyCharges) +
    parseAmount(formData.kanta);

  return {
    ...formData,
    grandTotal: formatAmount(grandTotal),
    balanceAmt: formatAmount(grandTotal - parseAmount(formData.advance)),
  };
};

export const normalizeBiltyFormData = (
  formData?: Record<string, string>
): BiltyFormState =>
  calculateBiltyTotals({
    ...initialBiltyFormData,
    ...(formData || {}),
    basisOfBooking: formData?.basisOfBooking || "To Pay",
  });

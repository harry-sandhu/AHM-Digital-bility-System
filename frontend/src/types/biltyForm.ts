export type BiltyFormState = {
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

export const initialBiltyFormData: BiltyFormState = {
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

export const normalizeBiltyFormData = (
  formData?: Record<string, string>
): BiltyFormState => ({
  ...initialBiltyFormData,
  ...(formData || {}),
});

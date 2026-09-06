export interface BiltyType {
  biltyNumber: string;
  consignmentNo?: number;
  createdBy: string;
  formData?: Record<string, unknown>;
  status?: "draft" | "expired";
  paymentAmount?: number;
  paymentPaidAt?: string;
  paymentExpiresAt?: string;
  expiresAt?: string;
  createdAt?: string;
}

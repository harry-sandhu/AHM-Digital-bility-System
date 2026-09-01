export interface BiltyType {
  biltyNumber: string;
  createdBy: string;
  formData?: Record<string, unknown>;
  status?: "draft" | "expired";
  paymentAmount?: number;
  paymentPaidAt?: string;
  paymentExpiresAt?: string;
  expiresAt?: string;
  createdAt?: string;
}

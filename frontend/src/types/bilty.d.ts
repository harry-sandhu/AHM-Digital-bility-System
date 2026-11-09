export interface BiltyRecord {
  _id: string;
  biltyNumber: string;
  consignmentNo?: number;
  status?: "draft" | "expired";
  paymentAmount?: number;
  /** Fee for current freight minus fee originally paid; >0 extra paid, <0 discount. */
  freightAdjustment?: number;
  extraPaid?: number;
  paymentPaidAt?: string;
  paymentExpiresAt?: string;
  expiresAt?: string;
  createdBy?: {
    _id?: string;
    name: string;
    phone: string;
    role: "superadmin" | "admin" | "user";
  };
  formData?: Record<string, string>;
  createdAt?: string;
}

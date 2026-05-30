export interface BiltyRecord {
  _id: string;
  biltyNumber: string;
  createdBy?: {
    _id?: string;
    name: string;
    phone: string;
    role: "superadmin" | "admin" | "user";
  };
  formData?: Record<string, string>;
  createdAt?: string;
}

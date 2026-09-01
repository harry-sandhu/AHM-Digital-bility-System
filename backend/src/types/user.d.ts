export interface UserType {
  _id: string;
  name: string;
  phone: string;
  password: string;
  role: "admin" | "superadmin" | "user";
  isActive: boolean;
  biltyAccessPaidAt?: string;
  biltyAccessExpiresAt?: string;
  biltyAccessAmount?: number;
}

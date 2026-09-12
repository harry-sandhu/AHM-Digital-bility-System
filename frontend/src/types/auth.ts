export type Role = "superadmin" | "admin" | "user";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  isActive: boolean;
  biltyAccessPaidAt?: string | null;
  biltyAccessExpiresAt?: string | null;
  biltyAccessAmount?: number;
  biltyAccessFreightAmount?: number | null;
}

export interface AuthPayload {
  token: string;
  user: AuthUser;
}

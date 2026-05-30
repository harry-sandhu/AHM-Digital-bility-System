export type Role = "superadmin" | "admin" | "user";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  isActive: boolean;
}

export interface AuthPayload {
  token: string;
  user: AuthUser;
}

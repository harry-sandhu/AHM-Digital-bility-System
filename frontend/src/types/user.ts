import type { Role } from "./auth";

export interface UserRecord {
  _id?: string;
  id?: string;
  name: string;
  phone: string;
  role: Role;
  isActive: boolean;
  groupId?: string;
  createdAt?: string;
}

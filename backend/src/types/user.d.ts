export interface UserType {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: "admin" | "superadmin";
}

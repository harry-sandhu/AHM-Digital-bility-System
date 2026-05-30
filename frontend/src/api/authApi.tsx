import axiosInstance from "../utils/axiosInstance";
import type { AuthPayload } from "../types/auth";

export const login = (data: { phone: string; password: string }) =>
  axiosInstance.post<AuthPayload>("/auth/login", data);

export const register = (data: {
  name: string;
  phone: string;
  password: string;
}) => axiosInstance.post("/auth/register", data);

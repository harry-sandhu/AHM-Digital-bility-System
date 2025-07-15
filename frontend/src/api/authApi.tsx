import axiosInstance from "../utils/axiosInstance";

export const login = (data: { email: string; password: string }) =>
  axiosInstance.post("/auth/login", data);

export const register = (data: {
  email: string;
  password: string;
  role?: string;
  phone?: string;
}) => axiosInstance.post("/auth/register", data);

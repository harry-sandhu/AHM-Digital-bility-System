import axiosInstance from "../utils/axiosInstance";
import type { UserRecord } from "../types/user";

export const getAllUsers = () => axiosInstance.get<UserRecord[]>("/users");

export const createAdminAccount = (data: {
  name: string;
  phone: string;
  password: string;
}) => axiosInstance.post("/users/admins", data);

export const disableUserAccount = (id: string) =>
  axiosInstance.patch(`/users/${id}/disable`);

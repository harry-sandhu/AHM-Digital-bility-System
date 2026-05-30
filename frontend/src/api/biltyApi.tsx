import axiosInstance from "../utils/axiosInstance";
import type { BiltyRecord } from "../types/bilty";

export const requestBiltyNumber = () => axiosInstance.get("/bilty/generate");

export const createBilty = (data: {
  biltyId: string;
  formData: Record<string, string>;
}) => axiosInstance.put<{ message: string; bilty: BiltyRecord }>(`/bilty/${data.biltyId}`, {
  formData: data.formData,
});

export const getMyBilties = () => axiosInstance.get<BiltyRecord[]>("/bilty/my");

export const getAllBilties = () => axiosInstance.get<BiltyRecord[]>("/bilty/all");

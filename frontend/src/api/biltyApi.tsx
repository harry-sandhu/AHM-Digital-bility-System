import axiosInstance from "../utils/axiosInstance";
import type { BiltyRecord } from "../types/bilty";
import type { AuthUser } from "../types/auth";

export const requestBiltyNumber = () =>
  axiosInstance.get<{
    message: string;
    biltyId: string;
    biltyNumber: string;
    consignmentNo: number;
    expiresAt: string;
    paymentAmount: number;
  }>("/bilty/generate");

export const purchaseBiltyAccess = (freightAmount: number) =>
  axiosInstance.post<{ message: string; user: AuthUser }>("/bilty/pay", {
    freightAmount,
  });

export const createBilty = (data: {
  biltyId: string;
  formData: Record<string, string>;
}) =>
  axiosInstance.put<{ message: string; bilty: BiltyRecord }>(
    `/bilty/${data.biltyId}`,
    {
      formData: data.formData,
    }
  );

export const getMyBilties = () => axiosInstance.get<BiltyRecord[]>("/bilty/my");

export const getAllBilties = () => axiosInstance.get<BiltyRecord[]>("/bilty/all");

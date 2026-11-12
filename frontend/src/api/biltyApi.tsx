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
  confirmExtraPayment?: boolean;
  confirmGstPayment?: boolean;
}) =>
  axiosInstance.put<{
    message: string;
    bilty: BiltyRecord;
    /** GST charge handed back as credit because freight went down. */
    gstCredited?: number;
    creditBalance?: number;
  }>(
    `/bilty/${data.biltyId}`,
    {
      formData: data.formData,
      confirmExtraPayment: data.confirmExtraPayment || undefined,
      confirmGstPayment: data.confirmGstPayment || undefined,
    }
  );

export const getMyBilties = () => axiosInstance.get<BiltyRecord[]>("/bilty/my");

export const getAllBilties = () => axiosInstance.get<BiltyRecord[]>("/bilty/all");

export const getBilty = (id: string) =>
  axiosInstance.get<BiltyRecord>(`/bilty/${id}`);

export const deleteBilty = (id: string) =>
  axiosInstance.delete<{ message: string }>(`/bilty/${id}`);

export const extractBillData = (file: File) => {
  const body = new FormData();
  body.append("bill", file);

  return axiosInstance.post<{
    message: string;
    extractedFields: Record<string, string>;
    /** Things the reader wasn't sure about (e.g. a GSTIN whose check character doesn't match). */
    warnings?: string[];
    /** Fields confirmed against the invoice's QR code. */
    verified?: string[];
    /** Set when the photo is too blurry/dark/small to read: nothing was filled. */
    retake?: string[];
    rawText: string;
  }>("/bilty/extract-bill", body, {
    headers: { "Content-Type": "multipart/form-data" },
    // Reading a bill can take a while on a slow server; the backend gives up after 90 s, so wait a little longer.
    timeout: 100_000,
  });
};

export const markBiltyPrinted = (id: string) =>
  axiosInstance.post<{ printedAt: string }>(`/bilty/${id}/print`);

export interface BiltyRevision {
  _id: string;
  formData: Record<string, string>;
  replacedAt: string | null;
  changedByName: string;
}

export const getBiltyRevisions = (id: string) =>
  axiosInstance.get<BiltyRevision[]>(`/bilty/${id}/revisions`);

import axiosInstance from "../utils/axiosInstance";

export const requestBiltyNumber = (userPhone: string) =>
  axiosInstance.post("/bilty/request", { userPhone });

export const createBilty = (data: any) =>
  axiosInstance.put(`/bilty/${data.biltyId}`, data);

export const getMyBilties = () => axiosInstance.get("/bilty/my");

export const getAllBilties = () => axiosInstance.get("/bilty/all");

export const getBiltyById = (id: string) => axiosInstance.get(`/bilty/${id}`);

import axiosInstance from "../utils/axiosInstance";

export interface SavedContact {
  id: string;
  address: string;
  gstin: string | null;
}

export const getConsignorContacts = () =>
  axiosInstance.get<SavedContact[]>("/contacts", {
    params: { kind: "consignor" },
  });

export const getConsigneeContacts = () =>
  axiosInstance.get<SavedContact[]>("/contacts", {
    params: { kind: "consignee" },
  });

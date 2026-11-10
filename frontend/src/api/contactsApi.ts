import axiosInstance from "../utils/axiosInstance";

export type SuggestionKind = "consignor" | "consignee" | "packing" | "delivery";

export interface SavedContact {
  id: string;
  address: string;
  gstin: string | null;
}

export interface ManagedSuggestion extends SavedContact {
  kind: SuggestionKind;
  ownerType: "user" | "group";
  ownerName: string;
}

/** The current user's own (or their group's) saved suggestions of one kind. */
export const getContacts = (kind: SuggestionKind) =>
  axiosInstance.get<SavedContact[]>("/contacts", { params: { kind } });

export const getConsignorContacts = () => getContacts("consignor");
export const getConsigneeContacts = () => getContacts("consignee");

// Superadmin management
export const getAllSuggestions = (kind?: SuggestionKind) =>
  axiosInstance.get<ManagedSuggestion[]>("/contacts/all", {
    params: kind ? { kind } : undefined,
  });

export const updateSuggestion = (
  id: string,
  data: { address?: string; gstin?: string }
) => axiosInstance.patch<SavedContact>(`/contacts/${id}`, data);

export const deleteSuggestion = (id: string) =>
  axiosInstance.delete<{ message: string }>(`/contacts/${id}`);

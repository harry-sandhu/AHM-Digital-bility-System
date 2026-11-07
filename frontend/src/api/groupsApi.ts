import axiosInstance from "../utils/axiosInstance";

export interface Group {
  id: string;
  name: string;
}

export const getAllGroups = () => axiosInstance.get<Group[]>("/groups");

export const createGroup = (name: string) =>
  axiosInstance.post<Group>("/groups", { name });

export const assignUserToGroup = (groupId: string, userId: string) =>
  axiosInstance.patch<{ message: string }>(
    `/groups/${groupId}/users/${userId}`
  );

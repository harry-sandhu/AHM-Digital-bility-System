import axiosInstance from "../utils/axiosInstance";
import type { NumberRange, NumberRangeScope } from "../types/numberRange";

export const getRanges = () =>
  axiosInstance.get<NumberRange[]>("/number-ranges");

export const createRange = (data: {
  label?: string;
  scope: NumberRangeScope;
  userId?: string;
  rangeStart: number;
  rangeEnd: number;
}) => axiosInstance.post<NumberRange>("/number-ranges", data);

export const updateRange = (
  id: string,
  data: Partial<Pick<NumberRange, "label" | "isActive" | "userId" | "rangeEnd">>
) => axiosInstance.patch<NumberRange>(`/number-ranges/${id}`, data);

export const deleteRange = (id: string) =>
  axiosInstance.delete(`/number-ranges/${id}`);

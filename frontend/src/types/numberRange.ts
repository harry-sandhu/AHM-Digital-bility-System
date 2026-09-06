export type NumberRangeScope = "master" | "personal";

export interface NumberRangeUser {
  _id: string;
  name: string;
  phone: string;
}

export interface NumberRange {
  _id: string;
  label?: string;
  scope: NumberRangeScope;
  userId?: string | NumberRangeUser | null;
  rangeStart: number;
  rangeEnd: number;
  nextNumber: number;
  remaining: number;
  isExhausted: boolean;
  isActive: boolean;
  createdAt?: string;
}

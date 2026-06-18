import type { BiltyFormState } from "../types/biltyForm";

export type StoredBiltyDraft = {
  biltyId: string;
  formData: BiltyFormState;
  hasSavedBilty: boolean;
  updatedAt: string;
};

export const getBiltyDraftStorageKey = (userId?: string) =>
  `biltyDraft:${userId || "anonymous"}`;

const isStoredBiltyDraft = (value: unknown): value is StoredBiltyDraft => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Partial<StoredBiltyDraft>;

  return (
    typeof draft.biltyId === "string" &&
    Boolean(draft.biltyId) &&
    typeof draft.formData === "object" &&
    draft.formData !== null &&
    typeof draft.hasSavedBilty === "boolean" &&
    typeof draft.updatedAt === "string"
  );
};

export const readBiltyDraft = (userId?: string): StoredBiltyDraft | null => {
  if (!userId || typeof window === "undefined") {
    return null;
  }

  const storedDraft = window.localStorage.getItem(getBiltyDraftStorageKey(userId));

  if (!storedDraft) {
    return null;
  }

  try {
    const parsedDraft = JSON.parse(storedDraft) as unknown;
    return isStoredBiltyDraft(parsedDraft) ? parsedDraft : null;
  } catch {
    return null;
  }
};

export const writeBiltyDraft = (
  userId: string | undefined,
  draft: StoredBiltyDraft
) => {
  if (!userId || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getBiltyDraftStorageKey(userId),
    JSON.stringify(draft)
  );
};

export const clearBiltyDraft = (userId?: string) => {
  if (!userId || typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getBiltyDraftStorageKey(userId));
};

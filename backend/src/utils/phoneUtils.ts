export const normalizePhone = (value: string) => value.replace(/\D/g, "");

export const isPhoneLengthValid = (value: string) =>
  value.length >= 10 && value.length <= 15;

import { digits } from "./validation.ts";

/** Normalize only search keys; preserve the original spelling in records and reports. */
export function searchKey(value: string) {
  return digits(value.normalize("NFKC"))
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function matchesSearch(fields: string[], query: string) {
  const key = searchKey(query);
  return !key || fields.some((field) => searchKey(field).includes(key));
}

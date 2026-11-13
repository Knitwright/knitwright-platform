import { randomInt } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** A team store's short-link code (decision 0153): ten characters with no look-alikes (no 0/O, 1/l/I). */
export const newStoreCode = (pick: (max: number) => number = randomInt): string =>
  Array.from({ length: 10 }, () => CODE_ALPHABET[pick(CODE_ALPHABET.length)]).join("");

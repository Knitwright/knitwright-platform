import { isIPv4, isIPv6 } from "node:net";

/**
 * Headers that carry the caller's address, most trusted first. The first is written by
 * Vercel and cannot be set by the caller. The others depend on the host overwriting
 * what the caller sent, which Vercel does. On another host, check this order again.
 */
const ADDRESS_HEADERS = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] as const;

const UNKNOWN = "unknown";
const MAPPED_IPV4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

const expandIPv6 = (address: string): string[] => {
  const [head, tail] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const gap = address.includes("::") ? Array(8 - left.length - right.length).fill("0") : [];
  return [...left, ...gap, ...right].map((group) => group.replace(/^0+(?=.)/, "").toLowerCase());
};

const normalise = (candidate: string): string | undefined => {
  const mapped = MAPPED_IPV4.exec(candidate)?.[1];
  if (mapped && isIPv4(mapped)) return mapped;
  if (isIPv4(candidate)) return candidate;
  if (isIPv6(candidate)) return `${expandIPv6(candidate).slice(0, 4).join(":")}::/64`;
  return undefined;
};

/**
 * The caller's address as a rate-limit key. Anything that is not an address becomes
 * "unknown", so header text can never forge another caller's key.
 */
export const clientAddress = (headers: Headers): string => {
  for (const name of ADDRESS_HEADERS) {
    const first = headers.get(name)?.split(",")[0]?.trim();
    if (!first) continue;
    return normalise(first) ?? UNKNOWN;
  }
  return UNKNOWN;
};

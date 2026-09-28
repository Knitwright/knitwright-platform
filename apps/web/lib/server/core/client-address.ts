import { isIPv4, isIPv6 } from "node:net";

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
 * The caller's address as a rate-limit key.
 *
 * Only one header is read: the one the host is known to write itself, named by the
 * CLIENT_ADDRESS_HEADER setting. Any other header could have been written by the
 * caller, who would then get a fresh rate limit with every request. When the trusted
 * header is missing, every caller shares the "unknown" key, so a wrong setting shows up
 * as a tight limit rather than as no limit.
 *
 * Anything that is not an address also becomes "unknown", so header text can never
 * forge another caller's key.
 */
export const clientAddress = (headers: Headers, trustedHeader: string): string => {
  const first = headers.get(trustedHeader)?.split(",")[0]?.trim();
  return (first && normalise(first)) || UNKNOWN;
};

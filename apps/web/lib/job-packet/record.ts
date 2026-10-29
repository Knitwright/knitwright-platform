import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { RateLimitRule } from "@/lib/server/core/guard";
import { packetRateKey } from "./token";

/**
 * The factory has no account, so its link is the only key. The wrapper has already limited the caller's
 * address; this limits the packet as well, so many addresses holding one link cannot flood its history.
 * The key names the packet by its token's hash, never the token.
 */

export type HitLimit = (key: string, rule: RateLimitRule) => Promise<boolean>;

export async function withPacketLimit<T>(hit: HitLimit, rule: RateLimitRule, token: string, run: () => Promise<T>): Promise<T> {
  if (!(await hit(`${rule.name}:packet:${packetRateKey(token)}`, rule))) throw new AppError("rate_limited", MESSAGES.rate_limited);
  return run();
}

/**
 * The token in a job route's own address, for the guard that runs before the body is read, which is given the
 * request and not the parsed parameters. Anything else gives the empty string, which opens nothing.
 */
export function tokenFromPath(url: string): string {
  const parts = new URL(url).pathname.split("/");
  const after = parts.indexOf("job") + 1;
  return after > 0 ? (parts[after] ?? "") : "";
}

import type { UsageMeter } from "@/lib/usage/meter";

/** A usage meter that counts what it was asked, so a test can see that a paid call was reserved and given back. */
export type CountingMeter = UsageMeter & { readonly reserved: () => number; readonly refunded: () => number };

export function countingMeter(allow = true): CountingMeter {
  let reserved = 0;
  let refunded = 0;
  return {
    reserved: () => reserved,
    refunded: () => refunded,
    reserve: async () => {
      reserved += 1;
      return allow ? { ok: true, eventId: "event-1" } : { ok: false, refused: "brand" };
    },
    refund: async () => {
      refunded += 1;
      return true;
    },
  };
}

import type { DropPayload } from "@/lib/collections/drop";
import { GAP_RULE_ID } from "./gap";
import { dropPayloadSchema } from "./schemas";

/**
 * Drops, from Z4's collection plans (plan v5 O2; spec F-S10, decision 0085).
 *
 * "Create drop" already writes the payload and `collection_drops` already keeps it, append-only and
 * numbered per collection. Nothing is rebuilt here: the stored payload is carried through exactly as
 * Z4 wrote it, with the row's own identity around it, so a drop the Store reads in a year is the
 * drop the brand exported.
 *
 * A row whose payload this deploy does not recognise is **refused**, with the row's id and what is
 * wrong with it, and left out of the list. A reader is told; it is not handed a half-parsed record.
 */

export interface DropRow {
  readonly dropId: string;
  readonly brandId: string;
  readonly collectionId: string;
  readonly version: number;
  readonly createdAt: string;
  readonly payload: unknown;
}

export interface StoreDrop {
  readonly dropId: string;
  readonly brandId: string;
  readonly collectionId: string;
  /** 1, then 2 on the next export. A Store that has read version 2 need not read version 1 again. */
  readonly version: number;
  readonly handedOverAt: string;
  /** Z4's payload, word for word, with its own `payloadVersion`. */
  readonly payload: DropPayload;
}

/** A row that could not be carried, and why. */
export interface Refused {
  readonly id: string;
  readonly reason: string;
  readonly ruleId: string;
}

export interface StoreDrops {
  readonly drops: readonly StoreDrop[];
  readonly refused: readonly Refused[];
}

const REASON = "The stored payload is not a shape this contract recognises. Export the drop again from the collection plan.";

/** Newest first, so a Store that keeps the last time it read can stop early. */
export function storeDrops(rows: readonly DropRow[]): StoreDrops {
  const drops: StoreDrop[] = [];
  const refused: Refused[] = [];
  for (const row of rows) {
    const parsed = dropPayloadSchema.safeParse(row.payload);
    if (!parsed.success) {
      refused.push({ id: row.dropId, reason: REASON, ruleId: GAP_RULE_ID });
      continue;
    }
    drops.push({
      dropId: row.dropId,
      brandId: row.brandId,
      collectionId: row.collectionId,
      version: row.version,
      handedOverAt: row.createdAt,
      payload: parsed.data as DropPayload,
    });
  }
  return {
    drops: drops.sort((a, b) => b.handedOverAt.localeCompare(a.handedOverAt) || b.version - a.version),
    refused,
  };
}

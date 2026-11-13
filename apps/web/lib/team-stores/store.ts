import type { PurchaseLine, StorePurchase, TeamStore } from "./model";

/**
 * The team store tables (migration 20261228020000) behind an interface, so the checkout and close rules are tested
 * without a database (`fixtures/memory-store.ts`) and run against one through the server's key (`db.ts`). Every
 * write is one of the migration's functions.
 */

export interface NewStore {
  readonly brandId: string;
  readonly userId: string;
  readonly code: string;
  readonly title: string;
  readonly projectId: string;
  readonly productId: string;
  readonly releaseId: string;
  readonly factoryProfileId: string;
  readonly fabricKey: string;
  readonly flags: readonly Readonly<{ code: string; text: string }>[];
  readonly currency: "GBP" | "AUD";
  readonly unitMinor: number;
  readonly priceLabel: string;
  readonly marginBps: number;
  readonly sizes: readonly string[];
  readonly namesNumbers: boolean;
  readonly nameMax: number;
  readonly minPieces: number;
  readonly seasonId: string | null;
  readonly opensAt: string;
  readonly closesAt: string;
}

export interface NewPurchase {
  readonly code: string;
  readonly requestKey: string;
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly lines: readonly PurchaseLine[];
}

export interface OpenedPurchase {
  readonly paymentId: string;
  readonly storeId: string;
  readonly brandId: string;
  readonly amountMinor: number;
  readonly currency: "GBP" | "AUD";
  readonly description: string;
  /** False when the same request key had already opened this payment. */
  readonly created: boolean;
}

export type CloseOutcome = "closed" | "refunding" | "refunded";

export interface TeamStoreStore {
  openStore(input: NewStore): Promise<string>;
  endStore(who: Readonly<{ brandId: string; userId: string }>, storeId: string, how: "close" | "cancel"): Promise<void>;
  storeById(id: string): Promise<TeamStore | null>;
  storeByCode(code: string): Promise<TeamStore | null>;
  openPurchase(input: NewPurchase): Promise<OpenedPurchase>;
  purchases(storeId: string): Promise<readonly StorePurchase[]>;
  beginClose(storeId: string): Promise<TeamStore>;
  finishClose(storeId: string, status: CloseOutcome, orderId: string | null, runId: string | null, message: string | null): Promise<void>;
  /** Stores the close run must look at: due, mid-close, refunding, or closed recently enough to catch a late payment. */
  storesToSweep(now: Date): Promise<readonly string[]>;
  purgeBuyers(now: Date): Promise<number>;
}

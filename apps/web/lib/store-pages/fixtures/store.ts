import type { AccountRow, PayoutRow, SaleRow } from "../store";

/**
 * Builders for the Store pages' tests and the /dev/store fixture page (decision 0156). Plain rows in the shape the
 * tables give; nothing here is a real sale.
 */

export const sale = (over: Partial<SaleRow> = {}): SaleRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  channel: "storefront",
  sourceRef: "sf-1001",
  productId: null,
  productName: "Home shirt 2027",
  quantity: 1,
  currency: "GBP",
  retailMinor: 4500,
  marginMinor: 1478,
  refundedMinor: 0,
  deliveredAt: null,
  soldAt: "2026-11-03T10:00:00.000Z",
  ...over,
});

export const payout = (over: Partial<PayoutRow> = {}): PayoutRow => ({
  id: "00000000-0000-4000-8000-0000000000a1",
  brandId: "00000000-0000-4000-8000-0000000000b1",
  currency: "GBP",
  amountMinor: 61200,
  status: "paid",
  provider: "test",
  accountId: "acct_test_kw_fixture0001",
  transferId: "tr_test_kw_fixture",
  failure: null,
  createdAt: "2026-11-06T09:00:00.000Z",
  sentAt: "2026-11-06T09:00:05.000Z",
  paidAt: "2026-11-08T09:00:00.000Z",
  ...over,
});

export const account = (over: Partial<AccountRow> = {}): AccountRow => ({
  provider: "test",
  accountId: "acct_test_kw_fixture0001",
  country: "GB",
  detailsSubmitted: true,
  payoutsEnabled: true,
  requirementsDue: 0,
  disabledReason: null,
  payoutFailure: null,
  ...over,
});

/** A month of a club's sales: some delivered, one refunded, one still waiting. */
export const MONTH_OF_SALES: readonly SaleRow[] = [
  sale({ id: "00000000-0000-4000-8000-000000000011", sourceRef: "sf-1", productName: "Home shirt 2027", quantity: 2, retailMinor: 9000, marginMinor: 2956, deliveredAt: "2026-11-10T00:00:00.000Z" }),
  sale({ id: "00000000-0000-4000-8000-000000000012", sourceRef: "sf-2", productName: "Away shirt 2027", retailMinor: 4800, marginMinor: 1700, deliveredAt: "2026-11-10T00:00:00.000Z" }),
  sale({ id: "00000000-0000-4000-8000-000000000013", sourceRef: "ts-3", channel: "team_store", productName: "Training tee", quantity: 3, retailMinor: 6000, marginMinor: 1500 }),
  sale({ id: "00000000-0000-4000-8000-000000000014", sourceRef: "sf-4", productName: "Home shirt 2027", retailMinor: 4500, marginMinor: 1478, refundedMinor: 4500, deliveredAt: "2026-11-11T00:00:00.000Z" }),
];

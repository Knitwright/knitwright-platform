import { describe, expect, it } from "vitest";
import { STORE_TABS } from "./routes";
import { costLine, EMPTY_SETTINGS, euReady, storeSettingsInput, toBrandingOption, toStoreSettings } from "./settings";
import { toAccount, toPayout, toSale } from "./store";

/** Decision 0156: the store settings' rules and the rows the pages read. */

describe("store settings", () => {
  it("takes a LUCID number as DE and its digits, in capitals", () => {
    const ok = storeSettingsInput.parse({ euRpName: "", euRpAddress: "", euRpEmail: "", brandContact: "", lucidNumber: "de1234567890123" });
    expect(ok.lucidNumber).toBe("DE1234567890123");
    expect(storeSettingsInput.safeParse({ ...ok, lucidNumber: "12345" }).success).toBe(false);
    expect(storeSettingsInput.safeParse({ ...ok, lucidNumber: "" }).success).toBe(true);
    expect(storeSettingsInput.safeParse({ ...ok, euRpEmail: "not an email" }).success).toBe(false);
  });

  it("reads a brand with no row as empty, and needs a whole EU responsible person", () => {
    expect(toStoreSettings(null)).toBe(EMPTY_SETTINGS);
    const row = toStoreSettings({ eu_rp_name: "EU Rep GmbH", eu_rp_address: "Berlin", eu_rp_email: "rep@eu.test", brand_contact: "", lucid_number: "", branding: { neck_labels: { on: true, note: "Crest" } } });
    expect(row.branding.neck_labels).toEqual({ on: true, note: "Crest" });
    expect(euReady(row)).toBe(true);
    expect(euReady({ ...row, euRpAddress: "" })).toBe(false);
    expect(toStoreSettings({ eu_rp_name: "", eu_rp_address: "", eu_rp_email: "", brand_contact: "", lucid_number: "", branding: "broken" }).branding).toEqual({});
  });

  it("says a branding cost from its row, or Free", () => {
    const option = toBrandingOption({ id: "packing_inserts", name: "Packing inserts", description: "d", cost_from_minor: 30, currency: "GBP", per: "order", details: "A6", is_placeholder: true });
    expect(costLine(option)).toBe("From £0.30 per order");
    expect(costLine({ ...option, per: null })).toBe("From £0.30");
    expect(costLine({ ...option, costFromMinor: null })).toBe("Free");
  });
});

describe("rows", () => {
  it("read a payout, a sale and an account", () => {
    expect(toPayout({ id: "00000000-0000-4000-8000-000000000001", brand_id: null, currency: "GBP", amount_minor: "100", status: "sent", provider: "test", provider_account_id: "acct", provider_transfer_id: "tr", failure: null, created_at: "t", sent_at: "t", paid_at: null })).toMatchObject({ amountMinor: 100, accountId: "acct", transferId: "tr" });
    expect(toSale({ id: "00000000-0000-4000-8000-000000000001", channel: "shopify", source_ref: "r", product_id: null, product_name: "p", quantity: 1, currency: "AUD", retail_minor: 1, margin_minor: 1, refunded_minor: 0, delivered_at: null, sold_at: "t" })).toMatchObject({ channel: "shopify", sourceRef: "r" });
    expect(toAccount({ provider: "stripe", provider_account_id: "acct", country: "GB", details_submitted: true, payouts_enabled: false, requirements_due: 1, disabled_reason: null, payout_failure: null })).toMatchObject({ accountId: "acct", requirementsDue: 1 });
  });

  it("name five tabs, Overview first", () => {
    expect(STORE_TABS.map((tab) => tab.label)).toEqual(["Overview", "Sales channels", "Branding", "Settings", "Payouts"]);
  });
});

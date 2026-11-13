import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Seller payouts and the store settings (plan v6 C5, decision 0156; migration 20261228040000), against local
 * Supabase. F-G4: "every payout is reconciled against delivered orders". A payout is the sum of delivered sales'
 * margin less refunds, less what earlier payouts paid; a refund after a payout comes off the next one; a failed
 * payout's sales are paid again; nothing is paid to an account Stripe cannot pay.
 *
 * `prepare_seller_payouts` runs over every brand in the shared database, so each test reads only its own brand.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

let opsPerson: Person;

type Seller = Readonly<{ owner: Person; brandId: string; accountId: string }>;

/** A new brand with a test Connect account; `payable` says whether Stripe can pay it yet. */
const seller = async (label: string, payable = true): Promise<Seller> => {
  const owner = await person(`payout-${label}`);
  const brandId = await brandOf(owner, `Payout ${label}`);
  const accountId = must(await rpc("open_seller_account", { p_actor: owner.userId, p_brand_id: brandId, p_provider: "test", p_account_id: `acct_test_kw_${randomUUID().replaceAll("-", "")}`, p_country: "GB" })) as string;
  if (payable) must(await rpc("update_seller_account", { p_account_id: accountId, p_details_submitted: true, p_charges_enabled: true, p_payouts_enabled: true, p_requirements_due: 0, p_disabled_reason: null }));
  return { owner, brandId, accountId };
};

/** A sale of 4500 retail whose margin is `margin` (the rest is base price). */
const sell = async (brandId: string, margin: number, ref = `sale-${randomUUID()}`) => {
  const id = must(
    await rpc("record_seller_sale", { p_brand_id: brandId, p_channel: "storefront", p_source_ref: ref, p_product_id: null, p_product_name: "Home shirt", p_quantity: 1, p_currency: "GBP", p_retail_minor: 4500, p_base_minor: 4500 - margin, p_shipping_minor: 0, p_duty_minor: 0, p_channel_fee_minor: 0, p_knitwright_fee_minor: 0, p_order_id: null }),
  ) as string;
  return { id, ref };
};

const deliver = async (saleId: string) => must(await rpc("confirm_seller_sale_delivered", { p_actor: opsPerson.userId, p_sale_id: saleId }));

type Payout = { id: string; brand_id: string; amount_minor: number; status: string };

/** Runs the weekly preparation and answers this brand's pending payout, if any. */
const prepare = async (brandId: string): Promise<Payout | undefined> => {
  const pending = must(await rpc("prepare_seller_payouts", { p_as_of: new Date().toISOString() })) as Payout[];
  return pending.find((one) => one.brand_id === brandId);
};

const send = async (payout: Payout) => must(await rpc("mark_seller_payout_sent", { p_payout_id: payout.id, p_transfer_id: `tr_${randomUUID()}` }));

const linesOf = async (payoutId: string) => must(await adminClient().from("seller_payout_lines").select("sale_id, amount_minor").eq("payout_id", payoutId)) as { sale_id: string; amount_minor: number }[];

beforeAll(async () => {
  opsPerson = await person("payout-ops");
  must(await adminClient().from("platform_admins").insert({ user_id: opsPerson.userId }).select("user_id"));
});

describe("a sale", () => {
  it("is recorded once per reference, with a margin that adds up", async () => {
    const { brandId } = await seller("record");
    const first = await sell(brandId, 1500, "same-ref-" + randomUUID());
    const again = must(await rpc("record_seller_sale", { p_brand_id: brandId, p_channel: "storefront", p_source_ref: first.ref, p_product_id: null, p_product_name: "Other", p_quantity: 9, p_currency: "GBP", p_retail_minor: 1, p_base_minor: 0, p_shipping_minor: 0, p_duty_minor: 0, p_channel_fee_minor: 0, p_knitwright_fee_minor: 0, p_order_id: null }));
    expect(again).toBe(first.id);
    expect(must(await adminClient().from("seller_sales").select("margin_minor, quantity").eq("id", first.id).single())).toEqual({ margin_minor: 1500, quantity: 1 });
  });

  it("is refused below cost, and for another brand's reference", async () => {
    const { brandId } = await seller("refuse");
    const { brandId: otherBrand } = await seller("refuse-other");
    const loss = await rpc("record_seller_sale", { p_brand_id: brandId, p_channel: "storefront", p_source_ref: randomUUID(), p_product_id: null, p_product_name: "Loss", p_quantity: 1, p_currency: "GBP", p_retail_minor: 1000, p_base_minor: 2000, p_shipping_minor: 0, p_duty_minor: 0, p_channel_fee_minor: 0, p_knitwright_fee_minor: 0, p_order_id: null });
    expect(loss.error?.hint).toBe("margin_negative");
    const { ref } = await sell(brandId, 100);
    const stolen = await rpc("record_seller_sale", { p_brand_id: otherBrand, p_channel: "storefront", p_source_ref: ref, p_product_id: null, p_product_name: "x", p_quantity: 1, p_currency: "GBP", p_retail_minor: 1, p_base_minor: 0, p_shipping_minor: 0, p_duty_minor: 0, p_channel_fee_minor: 0, p_knitwright_fee_minor: 0, p_order_id: null });
    expect(stolen.error?.hint).toBe("sale_conflict");
  });

  it("is marked delivered only by a platform admin", async () => {
    const { brandId, owner } = await seller("deliver");
    const { id } = await sell(brandId, 1000);
    expect((await rpc("confirm_seller_sale_delivered", { p_actor: owner.userId, p_sale_id: id })).error).not.toBeNull();
    await deliver(id);
    expect(must(await adminClient().from("seller_sales").select("delivered_by").eq("id", id).single())).toEqual({ delivered_by: "ops" });
  });
});

describe("the weekly payout", () => {
  it("pays delivered margin only", async () => {
    const { brandId } = await seller("delivered");
    const shipped = await sell(brandId, 1500);
    await sell(brandId, 900);
    await deliver(shipped.id);
    const payout = await prepare(brandId);
    expect(payout).toMatchObject({ amount_minor: 1500, status: "pending" });
    expect(await linesOf(payout!.id)).toEqual([{ sale_id: shipped.id, amount_minor: 1500 }]);
  });

  it("pays nobody whose account Stripe cannot pay, and nothing below the smallest payout", async () => {
    const blocked = await seller("blocked", false);
    await deliver((await sell(blocked.brandId, 1500)).id);
    expect(await prepare(blocked.brandId)).toBeUndefined();
    const tiny = await seller("tiny");
    await deliver((await sell(tiny.brandId, 50)).id);
    expect(await prepare(tiny.brandId)).toBeUndefined();
  });

  it("makes one pending payout per brand, and pays nothing twice", async () => {
    const { brandId } = await seller("once");
    await deliver((await sell(brandId, 1500)).id);
    const first = await prepare(brandId);
    expect((await prepare(brandId))?.id).toBe(first!.id);
    await send(first!);
    expect(await prepare(brandId)).toBeUndefined();
  });

  it("takes a refund before payout off the margin, and pays nothing for a full refund", async () => {
    const { brandId } = await seller("refund-before");
    const part = await sell(brandId, 1500);
    const whole = await sell(brandId, 1500);
    must(await rpc("record_seller_sale_refund", { p_source_ref: part.ref, p_refunded_total_minor: 500 }));
    must(await rpc("record_seller_sale_refund", { p_source_ref: whole.ref, p_refunded_total_minor: 4500 }));
    // A smaller total later changes nothing.
    must(await rpc("record_seller_sale_refund", { p_source_ref: part.ref, p_refunded_total_minor: 100 }));
    await deliver(part.id);
    await deliver(whole.id);
    expect(await prepare(brandId)).toMatchObject({ amount_minor: 1000 });
  });

  it("takes a refund after a payout off the next one", async () => {
    const { brandId } = await seller("refund-after");
    const first = await sell(brandId, 1500);
    await deliver(first.id);
    await send((await prepare(brandId))!);
    must(await rpc("record_seller_sale_refund", { p_source_ref: first.ref, p_refunded_total_minor: 4500 }));
    // On its own, the refund leaves nothing to pay.
    expect(await prepare(brandId)).toBeUndefined();
    const second = await sell(brandId, 2000);
    await deliver(second.id);
    const next = await prepare(brandId);
    expect(next).toMatchObject({ amount_minor: 500 });
    expect((await linesOf(next!.id)).sort((a, b) => a.amount_minor - b.amount_minor)).toEqual([
      { sale_id: first.id, amount_minor: -1500 },
      { sale_id: second.id, amount_minor: 2000 },
    ]);
  });

  it("pays a failed payout's sales again, and a reversed transfer counts as failed", async () => {
    const { brandId } = await seller("failed");
    await deliver((await sell(brandId, 1500)).id);
    const first = (await prepare(brandId))!;
    must(await rpc("mark_seller_payout_failed", { p_payout_id: first.id, p_transfer_id: null, p_reason: "Refused" }));
    const again = (await prepare(brandId))!;
    expect(again).toMatchObject({ amount_minor: 1500 });
    expect(again.id).not.toBe(first.id);
    const transfer = `tr_${randomUUID()}`;
    must(await rpc("mark_seller_payout_sent", { p_payout_id: again.id, p_transfer_id: transfer }));
    must(await rpc("mark_seller_payout_failed", { p_payout_id: null, p_transfer_id: transfer, p_reason: "Reversed" }));
    expect((await prepare(brandId))?.amount_minor).toBe(1500);
  });

  it("is paid when Stripe pays the seller's bank, and a failed bank payout is noted on the account", async () => {
    const { brandId, accountId } = await seller("bank");
    await deliver((await sell(brandId, 1500)).id);
    const payout = (await prepare(brandId))!;
    await send(payout);
    must(await rpc("record_connected_payout", { p_account_id: accountId, p_provider_payout_id: "po_1", p_status: "failed", p_created: new Date().toISOString() }));
    expect(must(await adminClient().from("seller_accounts").select("payout_failure").eq("brand_id", brandId).single())).toEqual({ payout_failure: expect.stringContaining("bank") });
    expect(must(await rpc("record_connected_payout", { p_account_id: accountId, p_provider_payout_id: "po_2", p_status: "paid", p_created: new Date(Date.now() + 60_000).toISOString() }))).toBe(1);
    expect(must(await adminClient().from("seller_payouts").select("status").eq("id", payout.id).single())).toEqual({ status: "paid" });
    expect(must(await adminClient().from("seller_accounts").select("payout_failure").eq("brand_id", brandId).single())).toEqual({ payout_failure: null });
  });
});

describe("F-G4: what Knitwright holds for sellers", () => {
  it("is shown to platform admins only, per currency", async () => {
    const { owner } = await seller("liability");
    const figures = must(await rpc("ops_seller_liability", { p_actor: opsPerson.userId })) as { currency: string; held_minor: number }[];
    expect(figures.map((row) => row.currency)).toEqual(["GBP", "AUD"]);
    expect((await rpc("ops_seller_liability", { p_actor: owner.userId })).error).not.toBeNull();
  });
});

describe("accounts and settings", () => {
  it("keeps one Connect account per brand, opened by an owner or admin", async () => {
    const { brandId, accountId, owner } = await seller("account");
    expect(must(await rpc("open_seller_account", { p_actor: owner.userId, p_brand_id: brandId, p_provider: "test", p_account_id: "acct_test_kw_second0000", p_country: "GB" }))).toBe(accountId);
    const stranger = await person("payout-stranger");
    expect((await rpc("open_seller_account", { p_actor: stranger.userId, p_brand_id: brandId, p_provider: "test", p_account_id: "acct_test_kw_stranger00", p_country: "GB" })).error?.code).toBe("42501");
    expect(must(await rpc("update_seller_account", { p_account_id: "acct_not_ours", p_details_submitted: true, p_charges_enabled: true, p_payouts_enabled: true, p_requirements_due: 0, p_disabled_reason: null }))).toBeNull();
  });

  it("saves GPSR, EPR and branding for owners and admins, and refuses a malformed LUCID number", async () => {
    const { brandId, owner } = await seller("settings");
    must(await rpc("set_store_settings", { p_actor: owner.userId, p_brand_id: brandId, p_eu_rp_name: "EU Rep GmbH", p_eu_rp_address: "Berlin", p_eu_rp_email: "rep@example.com", p_brand_contact: "hi@example.com", p_lucid_number: "de1234567890123" }));
    must(await rpc("set_store_branding", { p_actor: owner.userId, p_brand_id: brandId, p_option_id: "neck_labels", p_on: true, p_note: "Crest" }));
    expect(must(await owner.client.from("store_settings").select("lucid_number, branding").eq("brand_id", brandId).single())).toEqual({ lucid_number: "DE1234567890123", branding: { neck_labels: { on: true, note: "Crest" } } });
    expect((await rpc("set_store_settings", { p_actor: owner.userId, p_brand_id: brandId, p_eu_rp_name: "", p_eu_rp_address: "", p_eu_rp_email: "", p_brand_contact: "", p_lucid_number: "12" })).error?.hint).toBe("invalid_lucid");
    expect((await rpc("set_store_branding", { p_actor: owner.userId, p_brand_id: brandId, p_option_id: "invented", p_on: true, p_note: "" })).error?.hint).toBe("invalid_input");
    const stranger = await person("settings-stranger");
    expect((await rpc("set_store_settings", { p_actor: stranger.userId, p_brand_id: brandId, p_eu_rp_name: "x", p_eu_rp_address: "", p_eu_rp_email: "", p_brand_contact: "", p_lucid_number: "" })).error?.code).toBe("42501");
  });
});

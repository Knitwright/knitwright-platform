import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, paidRpc, person, type Person } from "./support";

/**
 * Storefronts, drops and made-to-order batches (plan v6 C3, decision 0154; migration 20261228030000), against local
 * Supabase. A shopper's order is priced from the published listing and nothing else; it is an ordinary C1 card
 * payment; a batch takes only paid orders, once; and the batch's order reaches production only through
 * submit_brand_run's payment gate, under the line the batch payment names.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };
const HASH = createHash("sha256").update("token").digest("hex");

let ann: Person;
let ben: Person;
let annBrand: string;
let benBrand: string;

type Made = Readonly<{ productId: string; projectId: string; releaseId: string; listingId: string; fabric: string }>;

/** A design of Ann's brand, listed at the run stage, with a published listing on its own fabric. */
const published = async (over: Record<string, unknown> = {}): Promise<Made> => {
  const projectId = must(await rpc("create_project", { p_brand_id: annBrand, p_user_id: ann.userId, p_name: "Shop tee", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;
  const release = must(await rpc("create_release", { p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId, p_label: "Shop", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  const releaseId = release[0]!.id;
  const productId = must(await rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: ann.userId, p_project_id: projectId, p_name: "Shop tee" })) as string;
  const fabric = `shop-${randomUUID().slice(0, 8)}`;
  must(await paidRpc(adminClient(), "submit_brand_run", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_kind: "sample", p_release_id: releaseId, p_factory_profile_id: "knitwright-default", p_fabric_key: fabric, p_sizes: { M: 1 }, p_flags: [], p_request_key: randomUUID() }));
  for (const to of ["sample", "run"]) must(await rpc("confirm_brand_product_stage", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_to: to }));
  const listing = must(
    await adminClient()
      .from("listings")
      .insert({ brand_id: annBrand, product_id: productId, title: "Shop tee", prices: { S: 2500, M: 2500, L: 2800 }, personalisation: true, personalisation_minor: 500, name_max: 6, release_id: releaseId, fabric_key: fabric, status: "published", published_at: new Date().toISOString(), ...over })
      .select("id")
      .single(),
  ) as { id: string };
  return { productId, projectId, releaseId, listingId: listing.id, fabric };
};

const shopOrder = (listingId: string, over: Record<string, unknown> = {}) =>
  rpc("open_shop_order", { p_listing_id: listingId, p_size: "M", p_qty: 2, p_name: null, p_number: null, p_email: "Fan@Example.test", p_country: "GB", p_size_confirmed: true, p_returns_accepted: true, p_access_hash: HASH, ...over });

/** Opens a shopper's order and pays it the way the webhook would. */
const paidShopOrder = async (listingId: string, over: Record<string, unknown> = {}) => {
  const [row] = must(await shopOrder(listingId, over)) as { shop_order_id: string; payment_id: string; amount_minor: number }[];
  const session = `cs_test_${randomUUID()}`;
  must(await rpc("attach_payment_session", { p_payment_id: row!.payment_id, p_provider: "test", p_session_id: session }));
  must(await rpc("record_payment_paid", { p_session_id: session, p_provider_payment_id: `pi_${randomUUID()}`, p_amount_minor: row!.amount_minor, p_currency: "gbp" }));
  return row!;
};

const lineFor = (made: Made, requestKey: string, sizes: Record<string, number>) => ({
  request_key: requestKey, product_id: made.productId, project_id: made.projectId, release_id: made.releaseId, factory_profile_id: "knitwright-default", fabric_key: made.fabric, sizes, flags: [],
});

beforeAll(async () => {
  [ann, ben] = await Promise.all([person("shop-ann"), person("shop-ben")]);
  annBrand = await brandOf(ann, "Shop Apparel");
  benBrand = await brandOf(ben, "Other Shop");
  must(await adminClient().from("storefronts").insert({ brand_id: annBrand, slug: `ann-${randomUUID().slice(0, 8)}`, name: "Ann's shop", status: "live", returns_policy: "Policy", batch_owner: ann.userId }).select("brand_id"));
  must(await adminClient().from("storefronts").insert({ brand_id: benBrand, slug: `ben-${randomUUID().slice(0, 8)}`, name: "Ben's shop", status: "draft", returns_policy: "Policy" }).select("brand_id"));
});

describe("a shopper's order", () => {
  it("is priced from the listing: (retail + personalisation) x quantity, as an ordinary card payment", async () => {
    const made = await published();
    const [row] = must(await shopOrder(made.listingId, { p_name: " ALI ", p_number: 7 })) as { payment_id: string; amount_minor: number; currency: string; brand_id: string }[];
    expect(row).toMatchObject({ amount_minor: 6000, currency: "GBP", brand_id: annBrand });
    const payment = must(await adminClient().from("order_payments").select("purpose, method, status, amount_minor, order_value_minor, created_by").eq("id", row!.payment_id).single());
    expect(payment).toEqual({ purpose: "order", method: "card", status: "open", amount_minor: 6000, order_value_minor: 6000, created_by: null });
    const order = must(await adminClient().from("shop_orders").select("personal_name, buyer_email, unit_minor, personalisation_minor").eq("payment_id", row!.payment_id).single());
    expect(order).toEqual({ personal_name: "ALI", buyer_email: "fan@example.test", unit_minor: 2500, personalisation_minor: 500 });
  });

  it("is refused for anything not on sale, a size not sold, a name too long, a closed drop or a missing tick", async () => {
    const made = await published();
    expect((await shopOrder(made.listingId, { p_size: "XL" })).error?.hint).toBe("size_not_sold");
    expect((await shopOrder(made.listingId, { p_name: "TOOLONGNAME" })).error?.hint).toBe("invalid_input");
    expect((await shopOrder(made.listingId, { p_qty: 21 })).error?.hint).toBe("invalid_input");
    expect((await shopOrder(made.listingId, { p_size_confirmed: false })).error).not.toBeNull();
    expect((await shopOrder(made.listingId, { p_country: "US" })).error).not.toBeNull();
    const draft = await published({ status: "draft", published_at: null });
    expect((await shopOrder(draft.listingId)).error?.hint).toBe("not_on_sale");
    const drop = await published({ mode: "drop" });
    expect((await shopOrder(drop.listingId)).error?.hint).toBe("drop_closed");
  });

  it("sells a drop listing only inside an open window, and remembers the drop", async () => {
    const made = await published({ mode: "drop" });
    const dropId = (must(await adminClient().from("storefront_drops").insert({ brand_id: annBrand, name: "Drop", opens_at: new Date(Date.now() - 3_600_000).toISOString(), closes_at: new Date(Date.now() + 3_600_000).toISOString() }).select("id").single()) as { id: string }).id;
    must(await adminClient().from("storefront_drop_listings").insert({ drop_id: dropId, listing_id: made.listingId, brand_id: annBrand }).select("drop_id"));
    const row = await paidShopOrder(made.listingId);
    expect(must(await adminClient().from("shop_orders").select("drop_id").eq("id", row.shop_order_id).single())).toEqual({ drop_id: dropId });
    const batch = must(await rpc("cut_storefront_batch", { p_listing_id: made.listingId, p_drop_id: dropId, p_cutoff: new Date().toISOString() })) as string;
    expect(must(await adminClient().from("storefront_batches").select("kind, sizes, pieces").eq("id", batch).single())).toEqual({ kind: "drop", sizes: { M: 2 }, pieces: 2 });
  });
});

describe("a made-to-order batch", () => {
  it("takes the paid orders before the cut-off, once, and leaves unpaid ones out", async () => {
    const made = await published();
    await paidShopOrder(made.listingId);
    await paidShopOrder(made.listingId, { p_size: "L", p_qty: 1 });
    must(await shopOrder(made.listingId, { p_size: "S" }));
    const cutoff = new Date(Date.now() + 1000).toISOString();
    const batch = must(await rpc("cut_storefront_batch", { p_listing_id: made.listingId, p_drop_id: null, p_cutoff: cutoff })) as string;
    expect(must(await adminClient().from("storefront_batches").select("sizes, pieces, status, kind").eq("id", batch).single())).toEqual({ sizes: { M: 2, L: 1 }, pieces: 3, status: "open", kind: "weekly" });
    expect(must(await rpc("cut_storefront_batch", { p_listing_id: made.listingId, p_drop_id: null, p_cutoff: cutoff }))).toBe(batch);
    const unpaid = must(await adminClient().from("shop_orders").select("batch_id").eq("listing_id", made.listingId).eq("size", "S").single());
    expect(unpaid).toEqual({ batch_id: null });
    expect(must(await rpc("cut_storefront_batch", { p_listing_id: (await published()).listingId, p_drop_id: null, p_cutoff: cutoff }))).toBeNull();
  });

  it("reaches production only under its batch payment line, through the payment gate", async () => {
    const made = await published();
    await paidShopOrder(made.listingId);
    const batch = must(await rpc("cut_storefront_batch", { p_listing_id: made.listingId, p_drop_id: null, p_cutoff: new Date(Date.now() + 1000).toISOString() })) as string;
    const key = `storefront-${batch}`;
    const submit = () => rpc("submit_brand_run", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: made.productId, p_kind: "run", p_release_id: made.releaseId, p_factory_profile_id: "knitwright-default", p_fabric_key: made.fabric, p_sizes: { M: 2 }, p_flags: [], p_request_key: key });
    expect((await submit()).error?.hint).toBe("payment_required");

    expect((await rpc("open_storefront_batch_payment", { p_batch_id: batch, p_user_id: ann.userId, p_line: lineFor(made, key, { M: 3 }) })).error?.hint).toBe("payment_mismatch");
    expect((await rpc("open_storefront_batch_payment", { p_batch_id: batch, p_user_id: ben.userId, p_line: lineFor(made, key, { M: 2 }) })).error?.code).toBe("42501");
    const paymentId = must(await rpc("open_storefront_batch_payment", { p_batch_id: batch, p_user_id: ann.userId, p_line: lineFor(made, key, { M: 2 }) })) as string;
    expect(must(await rpc("open_storefront_batch_payment", { p_batch_id: batch, p_user_id: ann.userId, p_line: lineFor(made, key, { M: 2 }) }))).toBe(paymentId);
    expect(must(await adminClient().from("order_payments").select("method, status, amount_minor, order_value_minor").eq("id", paymentId).single())).toEqual({ method: "invoice", status: "invoice", amount_minor: 0, order_value_minor: null });

    const [sent] = must(await submit()) as { order_id: string }[];
    expect(must(await adminClient().from("ops_orders").select("pieces").eq("id", sent!.order_id).single())).toEqual({ pieces: 2 });
    must(await rpc("settle_storefront_batch", { p_batch_id: batch, p_status: "sent", p_order_id: sent!.order_id, p_message: null }));
    must(await rpc("settle_storefront_batch", { p_batch_id: batch, p_status: "refused", p_order_id: null, p_message: "late" }));
    expect(must(await adminClient().from("storefront_batches").select("status, order_id").eq("id", batch).single())).toEqual({ status: "sent", order_id: sent!.order_id });
    expect((await rpc("open_storefront_batch_payment", { p_batch_id: batch, p_user_id: ann.userId, p_line: lineFor(made, key, { M: 2 }) })).data).toBe(paymentId);
  });
});

describe("who sees what", () => {
  it("shows a member their brand's storefront, listings and orders, and a stranger or a visitor nothing", async () => {
    const made = await published();
    await paidShopOrder(made.listingId);
    for (const table of ["storefronts", "listings", "shop_orders"]) {
      const mine = must(await ann.client.from(table).select("brand_id")) as { brand_id: string }[];
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((row) => row.brand_id === annBrand)).toBe(true);
      expect(must(await ben.client.from(table).select("brand_id").eq("brand_id", annBrand))).toEqual([]);
      const { data, error } = await anonClient().from(table).select("*");
      expect(error !== null || data?.length === 0).toBe(true);
    }
  });

  it("lets no browser write, and the server's key change no money row directly", async () => {
    expect((await ann.client.from("listings").update({ prices: { M: 1 } }).eq("brand_id", annBrand).select("id")).data ?? []).toEqual([]);
    expect((await adminClient().from("shop_orders").update({ amount_minor: 1 }).eq("brand_id", annBrand)).error?.code).toBe("42501");
    expect((await adminClient().from("storefront_batches").delete().eq("brand_id", annBrand)).error?.code).toBe("42501");
    expect((await anonClient().rpc("open_shop_order", { p_listing_id: randomUUID(), p_size: "M", p_qty: 1, p_name: null, p_number: null, p_email: "a@b.c", p_country: "GB", p_size_confirmed: true, p_returns_accepted: true, p_access_hash: HASH })).error).not.toBeNull();
  });
});

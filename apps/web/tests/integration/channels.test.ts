import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Sales channels (plan v6 C4, decision 0155; migration 20261228050000), against local Supabase.
 *
 * A shop's token is held only as ciphertext in the private schema and never answered to a member; a shop is
 * connected to one brand at a time; only owners and admins connect; a channel's order line is recorded once; a
 * Shopify order reaches production through C1's gate on an invoice line; uninstalling drops the token; the privacy
 * webhooks clear the buyer's address; and a brand sees only its own listings and orders.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };
const SEALED = { p_ciphertext: Buffer.from("c".repeat(40)).toString("base64"), p_nonce: Buffer.from("n".repeat(12)).toString("base64") };

let ann: Person;
let ben: Person;
let kit: Person;
let annBrand: string;
let benBrand: string;

const shop = () => `club-${randomUUID().slice(0, 8)}.myshopify.com`;

const connect = (brandId: string, userId: string, domain: string) =>
  rpc("channel_connect", { p_brand_id: brandId, p_user_id: userId, p_channel: "shopify", p_shop: domain, ...SEALED, p_scopes: "write_products" });

const secretOf = async (domain: string) => (must(await rpc("channel_connection_secret", { p_connection_id: null, p_channel: "shopify", p_shop: domain })) as Record<string, unknown>[])[0];

/** A product of Ann's brand with a frozen release, as the make flow leaves one. */
const product = async () => {
  const projectId = must(await rpc("create_project", { p_brand_id: annBrand, p_user_id: ann.userId, p_name: "Channel tee", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;
  const release = must(await rpc("create_release", { p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId, p_label: "Channel", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  const productId = must(await rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: ann.userId, p_project_id: projectId, p_name: "Channel tee" })) as string;
  return { projectId, productId, releaseId: release[0]!.id };
};

const receive = (connectionId: string | null, productId: string, orderId: string, shipTo: unknown = { name: "Sam", postcode: "LS1" }) =>
  rpc("channel_receive_order_line", { p_brand_id: annBrand, p_channel: connectionId ? "shopify" : "csv", p_connection_id: connectionId, p_external_order_id: orderId, p_external_line_id: "1", p_order_name: `#${orderId}`, p_product_id: productId, p_size_label: "M", p_pieces: 1, p_ship_to: shipTo });

beforeAll(async () => {
  [ann, ben, kit] = await Promise.all([person("chan-ann"), person("chan-ben"), person("chan-kit")]);
  annBrand = await brandOf(ann, "Channel Apparel");
  benBrand = await brandOf(ben, "Other Channel");
  must(await rpc("invite_member", { p_brand_id: annBrand, p_user_id: ann.userId, p_email: kit.email, p_role: "kit_manager" }));
  const invitations = must(await kit.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  must(await rpc("accept_invitation", { p_user_id: kit.userId, p_invitation_id: invitations.find((one) => one.brand_id === annBrand)?.id }));
});

describe("a channel connection", () => {
  it("is made by owners and admins only, and answers members without the token", async () => {
    const domain = shop();
    expect((await connect(annBrand, kit.userId, domain)).error?.code).toBe("42501");
    const id = must(await connect(annBrand, ann.userId, domain)) as string;
    const views = must(await rpc("channel_connections_of", { p_brand_id: annBrand, p_user_id: kit.userId })) as Record<string, unknown>[];
    expect(views).toEqual([expect.objectContaining({ id, shop_domain: domain, has_location: false })]);
    expect(JSON.stringify(views)).not.toContain(SEALED.p_ciphertext);
    expect((await rpc("channel_connections_of", { p_brand_id: annBrand, p_user_id: ben.userId })).error?.code).toBe("P0002");
    expect(await secretOf(domain)).toMatchObject({ id, brand_id: annBrand, token_ciphertext: SEALED.p_ciphertext });
    must(await rpc("channel_disconnect", { p_brand_id: annBrand, p_user_id: ann.userId, p_connection_id: id }));
  });

  it("keeps a shop to one brand, and a brand to one shop, and a reinstall refreshes the same row", async () => {
    const domain = shop();
    const id = must(await connect(annBrand, ann.userId, domain)) as string;
    expect((await connect(benBrand, ben.userId, domain)).error?.hint).toBe("shop_taken");
    expect((await connect(annBrand, ann.userId, shop())).error?.hint).toBe("channel_connected");
    expect(must(await connect(annBrand, ann.userId, domain))).toBe(id);
    must(await rpc("channel_set_location", { p_connection_id: id, p_location_id: "gid://shopify/Location/1" }));
    expect((await secretOf(domain))?.location_id).toBe("gid://shopify/Location/1");
    must(await rpc("channel_disconnect", { p_brand_id: annBrand, p_user_id: ann.userId, p_connection_id: id }));
    expect(await secretOf(domain)).toBeUndefined();
  });

  it("ends and drops its token when the shop uninstalls the app", async () => {
    const domain = shop();
    must(await connect(annBrand, ann.userId, domain));
    expect(must(await rpc("channel_uninstalled", { p_channel: "shopify", p_shop: domain }))).toBe(true);
    expect(await secretOf(domain)).toBeUndefined();
    expect(must(await rpc("channel_uninstalled", { p_channel: "shopify", p_shop: domain }))).toBe(false);
  });

  it("cannot be reached by a browser at all", async () => {
    for (const client of [ann.client, anonClient()]) {
      expect((await client.rpc("channel_connection_secret", { p_connection_id: null, p_channel: "shopify", p_shop: "x.myshopify.com" })).error).not.toBeNull();
      expect((await client.rpc("channel_connect", { p_brand_id: annBrand, p_user_id: ann.userId, p_channel: "shopify", p_shop: shop(), ...SEALED, p_scopes: "" })).error).not.toBeNull();
    }
  });
});

describe("a channel's order", () => {
  it("is recorded once, reaches production through C1's gate on an invoice line, and is read by its brand only", async () => {
    const domain = shop();
    const connectionId = must(await connect(annBrand, ann.userId, domain)) as string;
    const { productId, projectId, releaseId } = await product();
    must(await rpc("channel_record_listing", { p_brand_id: annBrand, p_user_id: kit.userId, p_connection_id: connectionId, p_product_id: productId, p_size_label: "M", p_external_product_id: "7", p_external_variant_id: `v-${randomUUID()}`, p_sku: "KW-x-M", p_price_minor: 3500, p_currency: "GBP", p_release_id: releaseId, p_factory_profile_id: "knitwright-default", p_fabric_key: "mesh", p_flags: [] }));

    const orderId = String(Date.now());
    const first = (must(await receive(connectionId, productId, orderId)) as { id: string; state: string; created: boolean }[])[0]!;
    expect(first).toMatchObject({ state: "received", created: true });
    expect((must(await receive(connectionId, productId, orderId)) as { created: boolean }[])[0]!.created).toBe(false);

    const key = `shp-${orderId}-1`;
    const fabric = `chan-${randomUUID().slice(0, 8)}`;
    const line = { request_key: key, door: "brand_run", product_id: productId, project_id: projectId, kind: "sample", release_id: releaseId, factory_profile_id: "knitwright-default", fabric_key: fabric, sizes: { M: 1 }, flags: [], pieces: 1, value_minor: null, price_label: null };
    const paymentId = must(await rpc("open_order_payment", { p_brand_id: annBrand, p_user_id: ann.userId, p_purpose: "order", p_method: "invoice", p_currency: "GBP", p_order_value_minor: null, p_amount_minor: 0, p_schedule: "full", p_description: `Shopify order #${orderId}`, p_credits: null, p_plan_id: null, p_plan_interval: null, p_lines: [line] })) as string;
    const sent = must(await rpc("submit_brand_run", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_kind: "sample", p_release_id: releaseId, p_factory_profile_id: "knitwright-default", p_fabric_key: fabric, p_sizes: { M: 1 }, p_flags: [], p_request_key: key })) as { order_id: string; run_id: string }[];
    must(await rpc("channel_settle_order_line", { p_id: first.id, p_state: "submitted", p_message: null, p_payment_id: paymentId, p_order_id: sent[0]!.order_id, p_run_id: sent[0]!.run_id }));

    const mine = must(await ann.client.from("channel_orders").select("state, order_id, payment_id").eq("id", first.id).single());
    expect(mine).toEqual({ state: "submitted", order_id: sent[0]!.order_id, payment_id: paymentId });
    expect(must(await ben.client.from("channel_orders").select("id").eq("id", first.id))).toEqual([]);
    expect(must(await ben.client.from("channel_listings").select("id").eq("brand_id", annBrand))).toEqual([]);
    expect((must(await ann.client.from("channel_listings").select("id").eq("connection_id", connectionId)) as unknown[]).length).toBe(1);
    expect((await rpc("channel_settle_order_line", { p_id: first.id, p_state: "waiting", p_message: null, p_payment_id: null, p_order_id: null, p_run_id: null })).error?.hint).toBe("invalid_input");
    expect(must(await rpc("channel_tracking_due", { p_limit: 200 })) as { id: string }[]).not.toContainEqual(expect.objectContaining({ id: first.id }));
    must(await rpc("channel_disconnect", { p_brand_id: annBrand, p_user_id: ann.userId, p_connection_id: connectionId }));
  });

  it("refuses a listing for a release that is not the product's, or from a viewer of another brand", async () => {
    const connectionId = must(await connect(annBrand, ann.userId, shop())) as string;
    const { productId } = await product();
    const args = { p_brand_id: annBrand, p_user_id: ann.userId, p_connection_id: connectionId, p_product_id: productId, p_size_label: "M", p_external_product_id: "7", p_external_variant_id: `v-${randomUUID()}`, p_sku: "KW-x-M", p_price_minor: 3500, p_currency: "GBP", p_release_id: randomUUID(), p_factory_profile_id: "f", p_fabric_key: "m", p_flags: [] };
    expect((await rpc("channel_record_listing", args)).error?.hint).toBe("release_not_found");
    expect((await rpc("channel_record_listing", { ...args, p_user_id: ben.userId })).error?.code).toBe("42501");
    must(await rpc("channel_disconnect", { p_brand_id: annBrand, p_user_id: ann.userId, p_connection_id: connectionId }));
  });

  it("loses the buyer's address on the privacy webhooks, and keeps a CSV order's", async () => {
    const domain = shop();
    const connectionId = must(await connect(annBrand, ann.userId, domain)) as string;
    const { productId } = await product();
    const [a, b] = [`${Date.now()}1`, `${Date.now()}2`];
    must(await receive(connectionId, productId, a));
    must(await receive(connectionId, productId, b));
    must(await receive(null, productId, `csv${Date.now()}`));
    expect(must(await rpc("channel_redact_customer", { p_channel: "shopify", p_shop: domain, p_order_ids: [a] }))).toBe(1);
    expect(must(await rpc("channel_redact_shop", { p_channel: "shopify", p_shop: domain }))).toBe(1);
    const rows = must(await adminClient().from("channel_orders").select("channel, ship_to").eq("brand_id", annBrand).in("external_order_id", [a, b])) as { ship_to: unknown }[];
    expect(rows.map((row) => row.ship_to)).toEqual([null, null]);
    expect(await secretOf(domain)).toBeUndefined();
  });
});

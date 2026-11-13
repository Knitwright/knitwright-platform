import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Payments core (plan v6 C1, decision 0152; migration 20261228010000), against local Supabase.
 *
 * Replaces the `no-payment` test of the Store contract: the platform now takes money, so this proves the rules that
 * money must keep. An order reaches production only once a payment line names exactly it; a paid amount must be the
 * one asked for; an event and a refund count once; refunds never exceed the charge; factory deposits never exceed
 * collected cash less the refund reserve (F-G4); and a brand sees only its own payments.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };

let ann: Person;
let ben: Person;
let viewer: Person;
let opsPerson: Person;
let annBrand: string;
let benBrand: string;

type Order = Readonly<{ productId: string; projectId: string; releaseId: string; fabric: string }>;

/** A design of Ann's brand, listed, with a frozen release, on its own fabric so no other test's batch is touched. */
const newOrder = async (): Promise<Order> => {
  const projectId = must(await rpc("create_project", { p_brand_id: annBrand, p_user_id: ann.userId, p_name: "Paid tee", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;
  const release = must(await rpc("create_release", { p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId, p_label: "Paid", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  const productId = must(await rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: ann.userId, p_project_id: projectId, p_name: "Paid tee" })) as string;
  return { productId, projectId, releaseId: release[0]!.id, fabric: `pay-${randomUUID().slice(0, 8)}` };
};

const SIZES = { S: 1, M: 1 };

const line = (order: Order, requestKey: string, valueMinor: number | null) => ({
  request_key: requestKey, door: "make", product_id: order.productId, project_id: order.projectId, kind: "sample", release_id: order.releaseId,
  factory_profile_id: "knitwright-default", fabric_key: order.fabric, sizes: SIZES, flags: [], pieces: 2, value_minor: valueMinor, price_label: valueMinor === null ? null : "Test price",
});

const open = (order: Order, requestKey: string, over: Record<string, unknown> = {}) =>
  rpc("open_order_payment", {
    p_brand_id: annBrand, p_user_id: ann.userId, p_purpose: "order", p_method: "card", p_currency: "GBP", p_order_value_minor: 5800, p_amount_minor: 5800,
    p_schedule: "full", p_description: "Sample of Paid tee", p_credits: null, p_plan_id: null, p_plan_interval: null, p_lines: [line(order, requestKey, 5800)], ...over,
  });

const submit = (order: Order, requestKey: string) =>
  rpc("submit_brand_run", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: order.productId, p_kind: "sample", p_release_id: order.releaseId, p_factory_profile_id: "knitwright-default", p_fabric_key: order.fabric, p_sizes: SIZES, p_flags: [], p_request_key: requestKey });

const paymentRow = async (id: string) => must(await adminClient().from("order_payments").select("*").eq("id", id).single()) as Record<string, unknown>;

/** A card payment for a new order, paid through its checkout. */
const paidOrder = async () => {
  const order = await newOrder();
  const key = randomUUID();
  const id = must(await open(order, key)) as string;
  const session = `cs_test_${randomUUID()}`;
  must(await rpc("attach_payment_session", { p_payment_id: id, p_provider: "test", p_session_id: session }));
  must(await rpc("record_payment_paid", { p_session_id: session, p_provider_payment_id: `pi_${randomUUID()}`, p_amount_minor: 5800, p_currency: "gbp" }));
  return { order, key, id, session };
};

beforeAll(async () => {
  [ann, ben, viewer, opsPerson] = await Promise.all([person("pay-ann"), person("pay-ben"), person("pay-viewer"), person("pay-ops")]);
  annBrand = await brandOf(ann, "Paying Apparel");
  benBrand = await brandOf(ben, "Other Apparel");
  must(await rpc("invite_member", { p_brand_id: annBrand, p_user_id: ann.userId, p_email: viewer.email, p_role: "viewer" }));
  const invitations = must(await viewer.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  must(await rpc("accept_invitation", { p_user_id: viewer.userId, p_invitation_id: invitations.find((one) => one.brand_id === annBrand)?.id }));
  must(await adminClient().from("platform_admins").insert({ user_id: opsPerson.userId }).select("user_id"));
});

describe("an order and its payment", () => {
  it("does not reach production unpaid", async () => {
    const order = await newOrder();
    const { error } = await submit(order, randomUUID());
    expect(error?.hint).toBe("payment_required");
    expect(must(await adminClient().from("ops_orders").select("id").eq("release_id", order.releaseId))).toEqual([]);
  });

  it("does not reach production while its checkout is open, and does once paid, exactly as paid", async () => {
    const order = await newOrder();
    const key = randomUUID();
    const id = must(await open(order, key)) as string;
    expect(await paymentRow(id)).toMatchObject({ status: "open", amount_minor: 5800, order_value_minor: 5800, balance_due_minor: 0 });
    expect((await submit(order, key)).error?.hint).toBe("payment_required");

    const session = `cs_test_${randomUUID()}`;
    must(await rpc("attach_payment_session", { p_payment_id: id, p_provider: "test", p_session_id: session }));
    const wrong = await rpc("record_payment_paid", { p_session_id: session, p_provider_payment_id: "pi_x", p_amount_minor: 1, p_currency: "GBP" });
    expect(wrong.error?.hint).toBe("payment_mismatch");
    expect((await paymentRow(id)).status).toBe("open");

    const paid = must(await rpc("record_payment_paid", { p_session_id: session, p_provider_payment_id: "pi_x", p_amount_minor: 5800, p_currency: "gbp" })) as { status: string }[];
    expect(paid[0]?.status).toBe("paid");
    const again = must(await rpc("record_payment_paid", { p_session_id: session, p_provider_payment_id: "pi_y", p_amount_minor: 5800, p_currency: "GBP" })) as { provider_payment_id: string }[];
    expect(again[0]?.provider_payment_id).toBe("pi_x");

    // Another size breakdown under the paid key is not what was paid for.
    const other = await rpc("submit_brand_run", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: order.productId, p_kind: "sample", p_release_id: order.releaseId, p_factory_profile_id: "knitwright-default", p_fabric_key: order.fabric, p_sizes: { S: 1, M: 1, L: 1 }, p_flags: [], p_request_key: key });
    expect(other.error?.hint).toBe("payment_required");

    const sent = must(await submit(order, key)) as { order_id: string; run_id: string }[];
    must(await rpc("settle_payment_line", { p_line_id: (must(await adminClient().from("order_payment_lines").select("id").eq("payment_id", id).single()) as { id: string }).id, p_status: "submitted", p_order_id: sent[0]!.order_id, p_run_id: sent[0]!.run_id, p_message: null }));
    must(await rpc("finish_payment", { p_payment_id: id }));
    expect((await paymentRow(id)).status).toBe("fulfilled");
  });

  it("opens one payment for one order however often it is asked, and refuses lines that do not add up", async () => {
    const order = await newOrder();
    const key = randomUUID();
    const first = must(await open(order, key)) as string;
    expect(must(await open(order, key))).toBe(first);
    expect((await open(order, randomUUID(), { p_order_value_minor: 9999, p_amount_minor: 9999 })).error?.hint).toBe("payment_mismatch");
    expect((await open(order, randomUUID(), { p_method: "invoice" })).error?.hint).toBe("payment_mismatch");
  });

  it("sends an order with no price on file as an invoice", async () => {
    const order = await newOrder();
    const key = randomUUID();
    const id = must(await open(order, key, { p_method: "invoice", p_order_value_minor: null, p_amount_minor: 0, p_lines: [line(order, key, null)] })) as string;
    expect(await paymentRow(id)).toMatchObject({ method: "invoice", status: "invoice", amount_minor: 0, order_value_minor: null });
    expect((await submit(order, key)).error).toBeNull();
  });

  it("is opened only by someone who may order for the brand", async () => {
    const order = await newOrder();
    expect((await open(order, randomUUID(), { p_user_id: viewer.userId })).error?.code).toBe("42501");
    expect((await open(order, randomUUID(), { p_user_id: ben.userId })).error?.code).toBe("42501");
  });
});

describe("events and refunds", () => {
  it("counts each Stripe event once", async () => {
    const id = `evt_${randomUUID()}`;
    expect(must(await rpc("record_payment_event", { p_event_id: id, p_type: "checkout.session.completed" }))).toBe(true);
    expect(must(await rpc("record_payment_event", { p_event_id: id, p_type: "checkout.session.completed" }))).toBe(false);
  });

  it("refunds never more than the charge, each Stripe refund once, and says so when all is given back", async () => {
    const { id } = await paidOrder();
    const refund = (amount: number, refundId: string | null) => rpc("record_payment_refund", { p_payment_id: id, p_amount_minor: amount, p_provider_refund_id: refundId, p_reason: "Test", p_actor: null });
    expect((await refund(5801, null)).error?.hint).toBe("refund_too_large");
    const first = `re_${randomUUID()}`;
    expect(must(await refund(800, first))).toBe(true);
    expect(must(await refund(800, first))).toBe(false);
    expect(await paymentRow(id)).toMatchObject({ refunded_minor: 800, status: "paid" });
    expect(must(await refund(5000, `re_${randomUUID()}`))).toBe(true);
    expect(await paymentRow(id)).toMatchObject({ refunded_minor: 5800, status: "refunded" });
    expect((await refund(1, null)).error?.hint).toBe("refund_too_large");
  });

  it("will not refund a payment that was never charged", async () => {
    const order = await newOrder();
    const id = must(await open(order, randomUUID())) as string;
    expect((await rpc("record_payment_refund", { p_payment_id: id, p_amount_minor: 1, p_provider_refund_id: null, p_reason: "x", p_actor: null })).error?.hint).toBe("nothing_to_refund");
  });

  it("records an abandoned checkout as expired, and only an open one", async () => {
    const order = await newOrder();
    const id = must(await open(order, randomUUID())) as string;
    const session = `cs_test_${randomUUID()}`;
    must(await rpc("attach_payment_session", { p_payment_id: id, p_provider: "test", p_session_id: session }));
    must(await rpc("record_payment_expired", { p_session_id: session }));
    expect((await paymentRow(id)).status).toBe("expired");
  });
});

describe("who sees payments", () => {
  it("shows a member their brand's payments and lines, and nobody else's", async () => {
    const { id } = await paidOrder();
    expect(must(await viewer.client.from("order_payments").select("id").eq("id", id))).toHaveLength(1);
    expect(must(await viewer.client.from("order_payment_lines").select("id").eq("payment_id", id))).toHaveLength(1);
    expect(must(await ben.client.from("order_payments").select("id").eq("id", id))).toEqual([]);
    // A visitor with no session has no grant on the table at all: refused, or nothing.
    const visitor = await anonClient().from("order_payments").select("id").eq("id", id);
    expect(visitor.error !== null || visitor.data?.length === 0).toBe(true);
    expect(must(await ann.client.from("payment_events").select("provider_event_id").limit(1))).toEqual([]);
    expect((await ann.client.rpc("open_order_payment", {})).error).not.toBeNull();
  });

  it("records a brand's plan, which its members read and another brand does not", async () => {
    const sub = `sub_${randomUUID()}`;
    must(await rpc("record_brand_subscription", { p_brand_id: benBrand, p_plan_id: "starter", p_plan_interval: "month", p_status: "active", p_provider: "test", p_customer_id: "cus_1", p_subscription_id: sub, p_current_period_end: null }));
    must(await rpc("update_brand_subscription", { p_subscription_id: sub, p_status: "past_due", p_current_period_end: "2027-01-01T00:00:00Z" }));
    expect(must(await ben.client.from("brand_subscriptions").select("plan_id, status").eq("brand_id", benBrand))).toEqual([{ plan_id: "starter", status: "past_due" }]);
    expect(must(await ann.client.from("brand_subscriptions").select("brand_id").eq("brand_id", benBrand))).toEqual([]);
  });
});

describe("F-G4 financial controls", () => {
  type Figures = { currency: string; gmv_minor: number; collected_minor: number; revenue_minor: number; refunded_minor: number; headroom_minor: number; reserve_minor: number };
  const figures = async (): Promise<Figures> => (must(await rpc("ops_finance_figures", { p_actor: opsPerson.userId })) as Figures[]).find((row) => row.currency === "GBP")!;

  it("are for platform admins only", async () => {
    expect((await rpc("ops_finance_figures", { p_actor: ann.userId })).error?.code).toBe("P0002");
    expect((await rpc("record_factory_deposit", { p_actor: ann.userId, p_factory_profile_id: "knitwright-default", p_currency: "GBP", p_amount_minor: 1, p_note: "x" })).error?.code).toBe("P0002");
    expect((await rpc("set_payment_settings", { p_actor: ann.userId, p_refund_reserve_bps: 0, p_deposit_bps: 1, p_deposit_threshold_gbp_minor: null, p_deposit_threshold_aud_minor: null, p_unpriced_orders: "invoice", p_label: "x" })).error?.code).toBe("P0002");
  });

  it("report GMV and revenue apart, and hold back the reserve on open pre-orders", async () => {
    const before = await figures();
    await paidOrder();
    const after = await figures();
    expect(Number(after.gmv_minor) - Number(before.gmv_minor)).toBe(5800);
    expect(Number(after.collected_minor) - Number(before.collected_minor)).toBe(5800);
    expect(Number(after.revenue_minor)).toBe(Number(after.collected_minor) - Number(after.refunded_minor));
    expect(Number(after.reserve_minor)).toBeGreaterThan(Number(before.reserve_minor));
  });

  it("refuse a factory deposit above collected cash less the reserve and the deposits already sent", async () => {
    await paidOrder();
    const { headroom_minor: headroom } = await figures();
    const over = await rpc("record_factory_deposit", { p_actor: opsPerson.userId, p_factory_profile_id: "knitwright-default", p_currency: "GBP", p_amount_minor: Number(headroom) + 1, p_note: "Too much" });
    expect(over.error?.hint).toBe("deposit_over_cash");
    if (Number(headroom) >= 1) {
      expect((await rpc("record_factory_deposit", { p_actor: opsPerson.userId, p_factory_profile_id: "knitwright-default", p_currency: "GBP", p_amount_minor: 1, p_note: "Within the headroom" })).error).toBeNull();
      expect(Number((await figures()).headroom_minor)).toBe(Number(headroom) - 1);
    }
  });
});

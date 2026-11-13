import { randomBytes, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, paidRpc, person, type Person } from "./support";

/**
 * Team stores and club pages (plan v6 C2, decision 0153; migration 20261228020000), against local Supabase.
 *
 * A store opens only for its club's own product and release; a buyer with no account opens a payment whose amount
 * the database works out from the store's own prices; at close the purchases paid at that moment are counted once;
 * a store at its minimum becomes ONE run order that C1's payment gate lets through and nothing else does; below it
 * the store refunds; buyers' details are erased 180 days after close; a club's address is its own.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);
const fabric = () => `ts-${randomUUID().slice(0, 8)}`;
const code = () => randomBytes(8).toString("hex").slice(0, 10);

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };

let ann: Person;
let ben: Person;
let viewer: Person;
let annBrand: string;
let benBrand: string;

type Design = Readonly<{ projectId: string; productId: string; releaseId: string; fabricKey: string }>;

/** A listed design with a frozen release. */
const design = async (owner: Person = ann, brandId: string = annBrand): Promise<Design> => {
  const projectId = must(await rpc("create_project", { p_brand_id: brandId, p_user_id: owner.userId, p_name: "Store kit", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;
  const release = must(await rpc("create_release", { p_project_id: projectId, p_brand_id: brandId, p_user_id: owner.userId, p_label: "v1", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  const productId = must(await rpc("create_brand_product", { p_brand_id: brandId, p_user_id: owner.userId, p_project_id: projectId, p_name: "Store kit" })) as string;
  return { projectId, productId, releaseId: release[0]!.id, fabricKey: fabric() };
};

/** The same design taken through a sample and a signed-off golden sample, so a run of it may be made. */
const runnable = async (): Promise<Design> => {
  const d = await design();
  const [sent] = must(await paidRpc(adminClient(), "submit_make_order", {
    p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: d.productId, p_kind: "sample", p_release_id: d.releaseId,
    p_factory_profile_id: "knitwright-default", p_fabric_key: fabric(), p_sizes: { S: 1, M: 1 }, p_flags: [], p_request_key: randomUUID(),
  })) as { run_id: string }[];
  const id = must(await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: d.productId, p_run_id: sent!.run_id })) as string;
  const fileId = randomUUID();
  must(await adminClient().from("files").insert({ id: fileId, brand_id: annBrand, bucket: "uploads", path: `${annBrand}/golden-sample/${randomUUID()}.png`, kind: "photo", provenance: "uploaded", content_type: "image/png", bytes: 10, created_by: ann.userId }));
  must(await rpc("add_golden_sample_photo", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_file_id: fileId, p_angle: "front", p_caption: "As it arrived" }));
  must(await rpc("add_golden_sample_pom", {
    p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_size_label: "M", p_letter: "A", p_code: "chest_1cm_below_armhole",
    p_measured_mm: 532, p_target_mm: 530, p_tol_minus_mm: 10, p_tol_plus_mm: 10, p_rule_id: "R-GAP-000",
  }));
  must(await rpc("sign_off_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_fit_rating: 4, p_colour_rating: 5, p_notes: "Good" }));
  return d;
};

const openStore = (d: Design, over: Record<string, unknown> = {}) =>
  rpc("open_team_store", {
    p_brand_id: annBrand, p_user_id: ann.userId, p_code: code(), p_title: "U16s home", p_project_id: d.projectId, p_product_id: d.productId, p_release_id: d.releaseId,
    p_factory_profile_id: "knitwright-default", p_fabric_key: d.fabricKey, p_flags: [], p_currency: "GBP", p_unit_minor: 2900, p_price_label: "Test price", p_margin_bps: 1000,
    p_sizes: ["S", "M", "L"], p_names_numbers: true, p_name_max: 12, p_min_pieces: 3, p_season_id: null,
    p_opens_at: new Date(Date.now() - 60_000).toISOString(), p_closes_at: new Date(Date.now() + 86_400_000).toISOString(), ...over,
  });

const storeRow = async (id: string) => must(await adminClient().from("team_stores").select("*").eq("id", id).single()) as Record<string, unknown>;

const buy = (storeCode: string, lines: unknown[], key: string = randomUUID()) =>
  rpc("open_team_store_payment", { p_code: storeCode, p_request_key: key, p_buyer_name: "Sam Parent", p_buyer_email: "Sam@Example.test", p_lines: lines });

const pay = async (paymentId: string, amount: number) => {
  const session = `cs_test_${randomUUID()}`;
  must(await rpc("attach_payment_session", { p_payment_id: paymentId, p_provider: "test", p_session_id: session }));
  must(await rpc("record_payment_paid", { p_session_id: session, p_provider_payment_id: `pi_${randomUUID()}`, p_amount_minor: amount, p_currency: "GBP" }));
};

/** An open store with the given pieces bought and paid. */
const storeWith = async (d: Design, paidLines: unknown[][], over: Record<string, unknown> = {}) => {
  const id = must(await openStore(d, over)) as string;
  const storeCode = (await storeRow(id)).code as string;
  for (const lines of paidLines) {
    const [opened] = must(await buy(storeCode, lines)) as { payment_id: string; amount_minor: number }[];
    await pay(opened!.payment_id, Number(opened!.amount_minor));
  }
  return { id, storeCode };
};

const closeNow = async (id: string) => {
  must(await rpc("end_team_store", { p_brand_id: annBrand, p_user_id: ann.userId, p_store_id: id, p_how: "close" }));
  return (must(await rpc("begin_team_store_close", { p_store_id: id })) as Record<string, unknown>[])[0]!;
};

beforeAll(async () => {
  [ann, ben, viewer] = await Promise.all([person("ts-ann"), person("ts-ben"), person("ts-viewer")]);
  annBrand = await brandOf(ann, "Store Lions");
  benBrand = await brandOf(ben, "Other Club");
  must(await rpc("invite_member", { p_brand_id: annBrand, p_user_id: ann.userId, p_email: viewer.email, p_role: "viewer" }));
  const invitations = must(await viewer.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  must(await rpc("accept_invitation", { p_user_id: viewer.userId, p_invitation_id: invitations.find((one) => one.brand_id === annBrand)?.id }));
});

describe("opening a store", () => {
  it("works out the club's margin on top of the base price", async () => {
    const id = must(await openStore(await design())) as string;
    expect(await storeRow(id)).toMatchObject({ unit_minor: 2900, margin_bps: 1000, margin_minor: 290, status: "open", min_pieces: 3, created_by: ann.userId });
  });

  it("is for the club's own kit managers, products and releases, with sensible dates and sizes", async () => {
    const d = await design();
    expect((await openStore(d, { p_user_id: viewer.userId })).error?.code).toBe("42501");
    expect((await openStore(d, { p_user_id: ben.userId })).error?.code).toBe("42501");
    const theirs = await design(ben, benBrand);
    expect((await openStore({ ...d, productId: theirs.productId })).error?.code).toBe("P0002");
    expect((await openStore({ ...d, releaseId: theirs.releaseId })).error?.hint).toBe("release_not_found");
    expect((await openStore(d, { p_closes_at: new Date(Date.now() - 1000).toISOString() })).error?.hint).toBe("invalid_dates");
    expect((await openStore(d, { p_sizes: [] })).error?.hint).toBe("invalid_sizes");
    expect((await openStore(d, { p_margin_bps: 700 })).error).not.toBeNull();
  });
});

describe("buying", () => {
  it("charges the store's own price for every piece and keeps the buyer's details as given", async () => {
    const { storeCode, id } = await storeWith(await design(), []);
    const [opened] = must(await buy(storeCode, [{ size_label: "M", print_name: "KHAN", print_number: "10" }, { size_label: "S" }])) as Record<string, unknown>[];
    expect(opened).toMatchObject({ amount_minor: 6380, currency: "GBP", store_id: id, brand_id: annBrand, created: true });
    const payment = must(await adminClient().from("order_payments").select("*").eq("id", opened!.payment_id as string).single()) as Record<string, unknown>;
    expect(payment).toMatchObject({ purpose: "team_store", method: "card", status: "open", amount_minor: 6380, order_value_minor: 6380, created_by: null });
    const purchase = must(await adminClient().from("team_store_orders").select("buyer_email, pieces, counted").eq("payment_id", opened!.payment_id as string).single());
    expect(purchase).toEqual({ buyer_email: "sam@example.test", pieces: 2, counted: false });
  });

  it("answers the same payment for the same request, and refuses what the store does not sell", async () => {
    const { storeCode } = await storeWith(await design(), []);
    const key = randomUUID();
    const [first] = must(await buy(storeCode, [{ size_label: "M" }], key)) as { payment_id: string }[];
    const [again] = must(await buy(storeCode, [{ size_label: "L" }, { size_label: "L" }], key)) as { payment_id: string; created: boolean }[];
    expect(again).toMatchObject({ payment_id: first!.payment_id, created: false });
    expect((await buy(storeCode, [{ size_label: "XXL" }])).error?.hint).toBe("invalid_sizes");
    expect((await buy(storeCode, [{ size_label: "M", print_name: "A VERY LONG NAME" }])).error?.hint).toBe("invalid_name");
    expect((await buy(storeCode, [{ size_label: "M", print_number: "100" }])).error?.hint).toBe("invalid_number");
    expect((await buy(storeCode, [])).error?.hint).toBe("invalid_input");
    expect((await buy("Zz9zZz9zZz", [{ size_label: "M" }])).error?.hint).toBe("store_not_found");
  });

  it("is refused before the store opens and after it closes", async () => {
    const later = await storeWith(await design(), [], { p_opens_at: new Date(Date.now() + 3_600_000).toISOString() });
    expect((await buy(later.storeCode, [{ size_label: "M" }])).error?.hint).toBe("store_not_open");
    const closed = await storeWith(await design(), []);
    await closeNow(closed.id);
    expect((await buy(closed.storeCode, [{ size_label: "M" }])).error?.hint).toBe("store_not_open");
  });
});

describe("closing", () => {
  it("below the minimum refunds, counting only what was paid", async () => {
    const { id, storeCode } = await storeWith(await design(), [[{ size_label: "M" }]]);
    must(await buy(storeCode, [{ size_label: "S" }, { size_label: "S" }]));
    const closed = await closeNow(id);
    expect(closed).toMatchObject({ status: "refunding", pieces_sold: 1, close_request_key: null });
    expect(closed.close_message).toMatch(/1 of the 3 pieces/);
    must(await rpc("finish_team_store_close", { p_store_id: id, p_status: "refunded", p_order_id: null, p_run_id: null, p_message: null }));
    expect((await storeRow(id)).status).toBe("refunded");
  });

  it("at the minimum becomes ONE run order, which the payment gate lets through exactly as the store names it", async () => {
    const d = await runnable();
    const { id } = await storeWith(d, [[{ size_label: "M", print_name: "KHAN", print_number: "10" }, { size_label: "L" }], [{ size_label: "M" }]]);
    const closing = await closeNow(id);
    expect(closing).toMatchObject({ status: "closing", pieces_sold: 3, close_sizes: { M: 2, L: 1 }, close_request_key: `team-store:${id}`, margin_owed_minor: 870 });
    const again = (must(await rpc("begin_team_store_close", { p_store_id: id })) as Record<string, unknown>[])[0]!;
    expect(again.close_sizes).toEqual({ M: 2, L: 1 });

    const send = (sizes: Record<string, number>) =>
      rpc("submit_make_order", {
        p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: d.productId, p_kind: "run", p_release_id: d.releaseId,
        p_factory_profile_id: "knitwright-default", p_fabric_key: d.fabricKey, p_sizes: sizes, p_flags: [], p_request_key: `team-store:${id}`,
      });
    expect((await send({ M: 3 })).error?.hint).toBe("payment_required");
    const [sent] = must(await send({ M: 2, L: 1 })) as { order_id: string; run_id: string }[];
    must(await rpc("finish_team_store_close", { p_store_id: id, p_status: "closed", p_order_id: sent!.order_id, p_run_id: sent!.run_id, p_message: null }));
    expect(await storeRow(id)).toMatchObject({ status: "closed", order_id: sent!.order_id });
    // The store's key answers with its one order however often it is sent: never a second order.
    const [repeat] = must(await send({ M: 2, L: 1 })) as { order_id: string; created: boolean }[];
    expect(repeat).toMatchObject({ order_id: sent!.order_id, created: false });
  });

  it("refunds a cancelled store's buyers through C1's refund record", async () => {
    const { id, storeCode } = await storeWith(await design(), []);
    const [opened] = must(await buy(storeCode, [{ size_label: "M" }])) as { payment_id: string }[];
    await pay(opened!.payment_id, 3190);
    must(await rpc("end_team_store", { p_brand_id: annBrand, p_user_id: ann.userId, p_store_id: id, p_how: "cancel" }));
    expect((await storeRow(id)).status).toBe("refunding");
    expect((await rpc("end_team_store", { p_brand_id: annBrand, p_user_id: ann.userId, p_store_id: id, p_how: "close" })).error?.hint).toBe("store_not_open");
    expect(must(await rpc("record_payment_refund", { p_payment_id: opened!.payment_id, p_amount_minor: 3190, p_provider_refund_id: `re_${randomUUID()}`, p_reason: "Cancelled", p_actor: null }))).toBe(true);
    const payment = must(await adminClient().from("order_payments").select("status").eq("id", opened!.payment_id).single());
    expect(payment).toEqual({ status: "refunded" });
  });

  it("is ended only by the club's kit managers", async () => {
    const { id } = await storeWith(await design(), []);
    expect((await rpc("end_team_store", { p_brand_id: annBrand, p_user_id: viewer.userId, p_store_id: id, p_how: "close" })).error?.code).toBe("42501");
    expect((await rpc("end_team_store", { p_brand_id: annBrand, p_user_id: ann.userId, p_store_id: id, p_how: "pause" })).error?.hint).toBe("invalid_input");
  });
});

describe("privacy", () => {
  it("erases buyers' names, emails and shirt names 180 days after close, and keeps the money record", async () => {
    const { id } = await storeWith(await design(), [[{ size_label: "M", print_name: "KHAN", print_number: "10" }]]);
    await closeNow(id);
    must(await rpc("purge_team_store_buyers", { p_now: new Date(Date.now() + 170 * 86_400_000).toISOString() }));
    expect(must(await adminClient().from("team_store_orders").select("buyer_name").eq("store_id", id).single())).toEqual({ buyer_name: "Sam Parent" });
    must(await rpc("purge_team_store_buyers", { p_now: new Date(Date.now() + 181 * 86_400_000).toISOString() }));
    const purchase = must(await adminClient().from("team_store_orders").select("buyer_name, buyer_email, details_erased_at, amount_minor").eq("store_id", id).single()) as Record<string, unknown>;
    expect(purchase).toMatchObject({ buyer_name: "", buyer_email: "", amount_minor: 3190 });
    expect(purchase.details_erased_at).not.toBeNull();
    expect(must(await adminClient().from("team_store_order_lines").select("print_name, print_number, size_label").eq("store_id", id).single())).toEqual({ print_name: "", print_number: "10", size_label: "M" });
  });

  it("shows a club its own stores and buyers, and another club nothing", async () => {
    const { id } = await storeWith(await design(), [[{ size_label: "M" }]]);
    expect(must(await viewer.client.from("team_store_orders").select("buyer_name").eq("store_id", id))).toEqual([{ buyer_name: "Sam Parent" }]);
    expect(must(await ben.client.from("team_stores").select("id").eq("id", id))).toEqual([]);
    expect(must(await ben.client.from("team_store_orders").select("id").eq("store_id", id))).toEqual([]);
    expect((await ben.client.rpc("open_team_store_payment", { p_code: "x", p_request_key: "x", p_buyer_name: "x", p_buyer_email: "x", p_lines: [] })).error).not.toBeNull();
  });
});

describe("a club page", () => {
  it("takes a free address, refuses a platform one and another club's, and only from the club's kit managers", async () => {
    const slug = `lions-${randomUUID().slice(0, 8)}`;
    must(await rpc("set_club_page", { p_brand_id: annBrand, p_user_id: ann.userId, p_slug: ` ${slug.toUpperCase()} `, p_contact: "kit@lions.example", p_published: true }));
    expect(must(await adminClient().from("club_pages").select("slug, published").eq("brand_id", annBrand).single())).toEqual({ slug, published: true });
    expect((await rpc("set_club_page", { p_brand_id: benBrand, p_user_id: ben.userId, p_slug: slug, p_contact: "", p_published: true })).error?.hint).toBe("slug_taken");
    expect((await rpc("set_club_page", { p_brand_id: benBrand, p_user_id: ben.userId, p_slug: "www", p_contact: "", p_published: true })).error?.hint).toBe("slug_taken");
    expect((await rpc("set_club_page", { p_brand_id: benBrand, p_user_id: ben.userId, p_slug: "a--b", p_contact: "", p_published: true })).error?.hint).toBe("invalid_slug");
    expect((await rpc("set_club_page", { p_brand_id: annBrand, p_user_id: viewer.userId, p_slug: slug, p_contact: "", p_published: false })).error?.code).toBe("42501");
  });
});

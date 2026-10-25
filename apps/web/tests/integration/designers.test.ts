import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261028020000: designer templates and the royalty ledger (decision 0061). A designer reads only their own
 * rows; only the server writes; a submission needs a rights statement to be sent or accepted; accepting makes a template
 * with attribution; an order for a design made from a designer template adds one ledger line per release, with
 * nothing accrued while the rate is not set; the ledger and payout notes are append-only. Needs `pnpm db:start`.
 */

const RATE_KEY = "designer.royalty_per_unit";
let designer: Person;
let other: Person;
let admin: Person;
let buyer: Person;
let buyerBrand: string;

const rpc = (fn: string, args: Record<string, unknown>) => adminClient().rpc(fn, args);

const draft = async (who: Person = designer): Promise<string> =>
  must(
    await rpc("template_submission_create", {
      p_user_id: who.userId, p_title: "Navy hoops", p_sport: "football", p_article_id: "crew-tee", p_wearer: "men",
      p_style_tags: ["hoops"], p_colour_family: "blue", p_snapshot: { made: "for the test" },
    }),
  ) as string;

/** A live designer template: draft, send, accept. Returns the template id. */
const liveTemplate = async (): Promise<string> => {
  const id = await draft();
  must(await rpc("template_submission_submit", { p_user_id: designer.userId, p_submission_id: id, p_rights_attested: true }));
  return must(await rpc("template_submission_approve", { p_actor: admin.userId, p_submission_id: id })) as string;
};

const orderFrom = async (templateId: string, sizes: Record<string, number>, currency: string | null = "AUD") => {
  const project = must(
    await rpc("create_project", { p_brand_id: buyerBrand, p_user_id: buyer.userId, p_name: "Copy", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 }),
  ) as string;
  must(await rpc("designer_record_use", { p_template_id: templateId, p_brand_id: buyerBrand, p_project_id: project }));
  const release = must(
    await rpc("create_release", { p_project_id: project, p_brand_id: buyerBrand, p_user_id: buyer.userId, p_label: "Round 1", p_snapshot: {}, p_file_specs: [], p_order_id: null }),
  ) as { id: string }[];
  const submitted = must(
    await rpc("submit_order_for_production", {
      p_release_id: release[0]!.id, p_external_ref: `store-${randomUUID()}`, p_factory_profile_id: "f1", p_fabric_key: "m", p_article_id: "crew-tee", p_sizes: sizes,
      ...(currency ? { p_value_minor: 1000, p_currency: currency } : {}),
    }),
  ) as { order_id: string }[];
  return { orderId: submitted[0]!.order_id, releaseId: release[0]!.id };
};

const lines = async (orderId: string) => must(await adminClient().from("royalty_accruals").select("*").eq("order_id", orderId));
const setRate = async (value: unknown) => {
  if (value === null) await adminClient().from("platform_settings").delete().eq("key", RATE_KEY);
  else must(await adminClient().from("platform_settings").upsert({ key: RATE_KEY, value }).select("key"));
};

beforeAll(async () => {
  [designer, other, admin, buyer] = await Promise.all([person("designer"), person("designer-other"), person("designer-admin"), person("designer-buyer")]);
  buyerBrand = await brandOf(buyer, "Buyer FC");
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  must(await rpc("designer_enrol", { p_user_id: designer.userId, p_display_name: "Ada Designer" }));
  must(await rpc("designer_enrol", { p_user_id: other.userId, p_display_name: "Other Designer" }));
});

afterAll(async () => {
  await setRate(null);
});

describe("submissions", () => {
  it("cannot be sent without the rights statement, and cannot skip it by direct write", async () => {
    const id = await draft();
    const { error } = await rpc("template_submission_submit", { p_user_id: designer.userId, p_submission_id: id, p_rights_attested: false });
    expect(error?.hint).toBe("rights_required");
    const direct = await adminClient().from("template_submissions").update({ status: "submitted" }).eq("id", id);
    expect(direct.error).not.toBeNull();
  });

  it("is sent by its own designer only", async () => {
    const id = await draft();
    const { error } = await rpc("template_submission_submit", { p_user_id: other.userId, p_submission_id: id, p_rights_attested: true });
    expect(error?.code).toBe("P0002");
  });

  it("is accepted by a platform admin into the library with the designer's name, and only once", async () => {
    const templateId = await liveTemplate();
    const row = must(await adminClient().from("templates").select("*").eq("id", templateId).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ source: "designer", designer_id: designer.userId, attribution: "Ada Designer", review_state: "not_reviewed" });
    const again = await rpc("template_submission_approve", { p_actor: admin.userId, p_submission_id: must(await adminClient().from("template_submissions").select("id").eq("template_id", templateId).single()).id });
    expect(again.error?.hint).toBe("not_submitted");
  });

  it("answers 'not found' to anyone who is not a platform admin", async () => {
    const id = await draft();
    must(await rpc("template_submission_submit", { p_user_id: designer.userId, p_submission_id: id, p_rights_attested: true }));
    for (const actor of [designer.userId, randomUUID()]) {
      expect((await rpc("template_submission_approve", { p_actor: actor, p_submission_id: id })).error?.code).toBe("P0002");
      expect((await rpc("template_submission_reject", { p_actor: actor, p_submission_id: id, p_reason: "No" })).error?.code).toBe("P0002");
    }
  });

  it("is rejected with a reason, with or without a rights statement", async () => {
    const id = await draft();
    expect((await rpc("template_submission_reject", { p_actor: admin.userId, p_submission_id: id, p_reason: "  " })).error?.hint).toBe("reason_required");
    must(await rpc("template_submission_reject", { p_actor: admin.userId, p_submission_id: id, p_reason: "Artwork is not theirs" }));
    const row = must(await adminClient().from("template_submissions").select("*").eq("id", id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ status: "rejected", rejection_reason: "Artwork is not theirs", rights_attested: false });
    expect((await rpc("template_submission_reject", { p_actor: admin.userId, p_submission_id: id, p_reason: "Again" })).error?.hint).toBe("already_decided");
  });
});

describe("who sees what", () => {
  it("shows a designer their own rows only, and an admin all", async () => {
    await draft(other);
    const mine = must(await designer.client.from("template_submissions").select("designer_id"));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.designer_id === designer.userId)).toBe(true);
    const everyone = must(await admin.client.from("template_submissions").select("designer_id"));
    expect(new Set(everyone.map((r) => r.designer_id))).toEqual(new Set([designer.userId, other.userId]));
    const profiles = must(await designer.client.from("designer_profiles").select("user_id"));
    expect(profiles.map((r) => r.user_id)).toEqual([designer.userId]);
  });

  it("lets nobody in a browser write, or read which brand used a template", async () => {
    expect((await designer.client.from("designer_profiles").update({ display_name: "x" }).eq("user_id", designer.userId).select()).data ?? []).toEqual([]);
    expect((await designer.client.from("template_submissions").insert({ designer_id: designer.userId, title: "x" })).error).not.toBeNull();
    expect((await designer.client.from("designer_template_uses").select("*")).error).not.toBeNull();
    for (const fn of ["designer_enrol", "designer_accrue_for_order", "designer_set_payout_state"]) {
      expect((await designer.client.rpc(fn, { p_user_id: designer.userId, p_display_name: "x", p_order_id: randomUUID(), p_actor: designer.userId, p_designer_id: designer.userId, p_state: "paid" })).error).not.toBeNull();
    }
  });
});

describe("the royalty ledger", () => {
  it("counts units and accrues nothing while the rate is not set", async () => {
    await setRate(null);
    const templateId = await liveTemplate();
    const { orderId } = await orderFrom(templateId, { M: 3, L: 2 });
    expect(await lines(orderId)).toMatchObject([{ designer_id: designer.userId, template_id: templateId, units: 5, rate_minor: null, currency: null, accrued_minor: 0 }]);
  });

  it("accrues units times the rate, in the order's currency, once the rate is set", async () => {
    await setRate(40);
    const templateId = await liveTemplate();
    const { orderId } = await orderFrom(templateId, { M: 3, L: 2 });
    expect(await lines(orderId)).toMatchObject([{ units: 5, rate_minor: 40, currency: "AUD", accrued_minor: 200 }]);
    await setRate(null);
  });

  it("accrues nothing for an order with no currency, even with a rate", async () => {
    await setRate(40);
    const { orderId } = await orderFrom(await liveTemplate(), { M: 1 }, null);
    expect(await lines(orderId)).toMatchObject([{ units: 1, rate_minor: null, accrued_minor: 0 }]);
    await setRate(null);
  });

  it("is once per release, however many times it runs, and a later rate does not rewrite a line", async () => {
    const { orderId } = await orderFrom(await liveTemplate(), { M: 2 });
    expect(must(await rpc("designer_accrue_for_order", { p_order_id: orderId }))).toBe(false);
    await setRate(10);
    expect(must(await rpc("designer_accrue_for_order", { p_order_id: orderId }))).toBe(false);
    expect(await lines(orderId)).toHaveLength(1);
    await setRate(null);
  });

  it("ignores an order for a design not made from a designer template", async () => {
    const project = must(
      await rpc("create_project", { p_brand_id: buyerBrand, p_user_id: buyer.userId, p_name: "Own", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "own" }, p_schema_version: 1 }),
    ) as string;
    const release = must(await rpc("create_release", { p_project_id: project, p_brand_id: buyerBrand, p_user_id: buyer.userId, p_label: "Own", p_snapshot: {}, p_file_specs: [], p_order_id: null })) as { id: string }[];
    const order = must(await rpc("submit_order_for_production", { p_release_id: release[0]!.id, p_external_ref: `store-${randomUUID()}`, p_factory_profile_id: "f1", p_fabric_key: "m", p_article_id: "crew-tee", p_sizes: { M: 1 } })) as { order_id: string }[];
    expect(await lines(order[0]!.order_id)).toEqual([]);
  });

  it("holds counts, never names: a designer sees units, not the brand or the roster", async () => {
    const { orderId } = await orderFrom(await liveTemplate(), { M: 2 });
    const seen = must(await designer.client.from("royalty_accruals").select("*").eq("order_id", orderId));
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0]!).sort()).not.toContain("brand_id");
    expect((await other.client.from("royalty_accruals").select("*").eq("order_id", orderId)).data).toEqual([]);
  });

  it("can never be changed or removed, by the server's key either", async () => {
    const { orderId } = await orderFrom(await liveTemplate(), { M: 1 });
    expect((await adminClient().from("royalty_accruals").update({ units: 99 }).eq("order_id", orderId)).error).not.toBeNull();
    expect((await adminClient().from("royalty_accruals").delete().eq("order_id", orderId)).error).not.toBeNull();
    expect(await lines(orderId)).toHaveLength(1);
  });
});

describe("the payout note", () => {
  it("is set by an admin only, is a note, and keeps its history", async () => {
    expect((await rpc("designer_set_payout_state", { p_actor: designer.userId, p_designer_id: designer.userId, p_state: "paid", p_note: "" })).error?.code).toBe("P0002");
    must(await rpc("designer_set_payout_state", { p_actor: admin.userId, p_designer_id: designer.userId, p_state: "on_hold", p_note: "waiting for a rate" }));
    must(await rpc("designer_set_payout_state", { p_actor: admin.userId, p_designer_id: designer.userId, p_state: "paid", p_note: "" }));
    const seen = must(await designer.client.from("designer_payout_events").select("state").order("seq"));
    expect(seen.map((r) => r.state)).toEqual(["on_hold", "paid"]);
    expect((await adminClient().from("designer_payout_events").delete().eq("designer_id", designer.userId)).error).not.toBeNull();
    expect((await rpc("designer_set_payout_state", { p_actor: admin.userId, p_designer_id: designer.userId, p_state: "sent", p_note: "" })).error).not.toBeNull();
  });
});

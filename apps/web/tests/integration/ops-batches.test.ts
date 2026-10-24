import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { nextCutoff } from "@/lib/ops/cutoff";
import { SubmitOrderError, submitOrderForProduction } from "@/lib/ops/contract";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Ops console part 1 (decision 0043): the Store's one door, the weekly cut-off, batches, status steps,
 * delays and append-only history. Platform admins read everything; a member reads their own brand's orders
 * and history; no browser role writes. The SQL was also run by hand against a bare Postgres 16 with stub
 * tables (see the PR); this file is the repository's own check and needs `pnpm db:start`.
 */

let alice: Person;
let bob: Person;
let admin: Person;
let aliceBrand: string;
let releaseId: string;
let secondReleaseId: string;
let savedSettings: Record<string, unknown>;

const ref = () => `store-${Math.random().toString(36).slice(2)}`;
const SIZES = { M: 3, L: 2 };
const submit = (over: Record<string, unknown> = {}) =>
  submitOrderForProduction(adminClient(), { releaseId, externalRef: ref(), factoryProfileId: "f1", fabricKey: "mesh", articleId: "team-jersey", sizes: SIZES, ...over });

const makeRelease = async (owner: Person, brandId: string, label: string): Promise<string> => {
  const project = must(
    await adminClient().rpc("create_project", { p_brand_id: brandId, p_user_id: owner.userId, p_name: "Jersey", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 }),
  ) as string;
  const created = must(
    await adminClient().rpc("create_release", { p_project_id: project, p_brand_id: brandId, p_user_id: owner.userId, p_label: label, p_snapshot: { specVersion: 1, rosterHash: null, files: [] }, p_file_specs: [], p_order_id: null }),
  ) as { id: string }[];
  return created[0]!.id;
};

const actor = () => admin.userId;
const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, { p_actor: actor(), ...args });
const row = async (id: string) => must(await adminClient().from("ops_orders").select("*").eq("id", id).single()) as Record<string, unknown>;
const kinds = async (id: string) => (must(await adminClient().from("ops_order_events").select("kind").eq("order_id", id).order("at").order("id")) as { kind: string }[]).map((e) => e.kind);
/** Cuts the batches as of one second after this order's cut-off, as ops would on the day. */
const cutAfter = async (id: string) => must(await rpc("ops_cut_batches", { p_now: new Date(Date.parse((await row(id)).cutoff_at as string) + 1000).toISOString() }));

beforeAll(async () => {
  [alice, bob, admin] = await Promise.all([person("ops-alice"), person("ops-bob"), person("ops-admin")]);
  aliceBrand = await brandOf(alice, "Alice FC");
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  releaseId = await makeRelease(alice, aliceBrand, "Round 1 jerseys");
  secondReleaseId = await makeRelease(alice, aliceBrand, "Round 2 jerseys");
  savedSettings = must(await adminClient().from("ops_settings").select("*").single()) as Record<string, unknown>;
});

afterAll(async () => {
  const [hh, mm] = String(savedSettings.cutoff_time).split(":").map(Number);
  await rpc("ops_update_settings", { p_weekday: savedSettings.cutoff_weekday, p_minutes: (hh ?? 0) * 60 + (mm ?? 0), p_lead_time_days: savedSettings.lead_time_days, p_label: savedSettings.label });
});

describe("the settings", () => {
  it("start as a labelled default with no lead time", async () => {
    expect(savedSettings.label).toMatch(/not agreed with a factory/);
    expect(savedSettings.lead_time_days).toBeNull();
  });
});

describe("submit_order_for_production", () => {
  it("takes the brand and design from the release, counts pieces, and promises no date while no lead time is set", async () => {
    const out = await submit();
    expect(out).toMatchObject({ status: "submitted", promisedOn: null, leadTimeDays: null, created: true });
    const stored = await row(out.orderId);
    expect(stored).toMatchObject({ brand_id: aliceBrand, pieces: 5, release_id: releaseId, value_minor: null });
    expect(stored.release_snapshot).toMatchObject({ label: "Round 1 jerseys", number: 1 });
    expect(await kinds(out.orderId)).toEqual(["submitted"]);
  });

  it("falls under the cut-off the TypeScript sum gives", async () => {
    const before = new Date();
    const out = await submit();
    const after = new Date();
    const expected = [nextCutoff(before, savedSettings as never), nextCutoff(after, savedSettings as never)].map((d) => d.toISOString());
    expect(expected).toContain(out.cutoffAt);
  });

  it("is idempotent on the Store's reference, and refuses the reference with another release", async () => {
    const externalRef = ref();
    const first = await submit({ externalRef });
    const again = await submit({ externalRef });
    expect(again).toMatchObject({ orderId: first.orderId, created: false });
    await expect(submit({ externalRef, releaseId: secondReleaseId })).rejects.toMatchObject({ code: "external_ref_conflict" });
    expect(must(await adminClient().from("ops_order_events").select("id").eq("order_id", first.orderId))).toHaveLength(1);
  });

  it("refuses an unknown release and bad sizes, by hint", async () => {
    await expect(submit({ releaseId: "99999999-9999-4999-8999-999999999999" })).rejects.toMatchObject({ code: "release_not_found" });
    for (const bad of [{}, { M: 0 }, { M: 1.5 }, { M: "x" }, [1]]) {
      const { error } = await adminClient().rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: ref(), p_factory_profile_id: "f1", p_fabric_key: "m", p_article_id: "a", p_sizes: bad });
      expect(error?.hint, JSON.stringify(bad)).toBe("invalid_sizes");
    }
    const { error } = await adminClient().rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: ref(), p_factory_profile_id: "f1", p_fabric_key: "m", p_article_id: "a", p_sizes: SIZES, p_value_minor: 100 });
    expect(error?.hint).toBe("invalid_value");
  });

  it("stores the Store's value with its currency and sets none itself", async () => {
    const out = await submit({ valueMinor: 125000, currency: "AUD" });
    expect(await row(out.orderId)).toMatchObject({ value_minor: 125000, currency: "AUD" });
  });

  it("can be run by the server's key only", async () => {
    for (const client of [alice.client, bob.client, admin.client]) {
      const { error } = await client.rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: ref(), p_factory_profile_id: "f", p_fabric_key: "f", p_article_id: "a", p_sizes: SIZES });
      expect(error).not.toBeNull();
    }
  });

  it("wraps database errors as typed errors", async () => {
    await expect(submit({ sizes: {} })).rejects.toBeInstanceOf(SubmitOrderError);
  });
});

describe("batches", () => {
  it("cut only the orders whose cut-off has come, grouped by factory, fabric and article", async () => {
    const [a, b, c] = [await submit({ fabricKey: "g-mesh" }), await submit({ fabricKey: "g-mesh" }), await submit({ fabricKey: "g-cotton" })];
    const cutoff = Date.parse((await row(a.orderId)).cutoff_at as string);
    must(await rpc("ops_cut_batches", { p_now: new Date(cutoff - 1000).toISOString() }));
    expect((await row(a.orderId)).status).toBe("submitted");
    await cutAfter(a.orderId);
    const [ra, rb, rc] = await Promise.all([a, b, c].map((o) => row(o.orderId)));
    expect(ra!.status).toBe("batched");
    expect(ra!.batch_id).toBe(rb!.batch_id);
    expect(rc!.batch_id).not.toBe(ra!.batch_id);
    expect(await kinds(a.orderId)).toEqual(["submitted", "batched"]);
  });

  it("are run by platform admins only", async () => {
    const { error } = await adminClient().rpc("ops_cut_batches", { p_actor: alice.userId });
    expect(error?.code).toBe("P0002");
  });

  it("let ops hold an order, release it, and move it only within its own factory, fabric and article", async () => {
    const a = await submit({ fabricKey: "m-1" });
    const b = await submit({ fabricKey: "m-1" });
    const other = await submit({ fabricKey: "m-other" });
    await cutAfter(a.orderId);
    must(await rpc("ops_set_hold", { p_order_id: a.orderId, p_hold: true, p_note: "artwork query" }));
    expect(await row(a.orderId)).toMatchObject({ status: "held", batch_id: null });
    const target = (await row(b.orderId)).batch_id;
    const mismatch = await rpc("ops_move_order", { p_order_id: a.orderId, p_batch_id: (await row(other.orderId)).batch_id });
    expect(mismatch.error?.hint).toBe("batch_mismatch");
    must(await rpc("ops_move_order", { p_order_id: a.orderId, p_batch_id: target }));
    expect(await row(a.orderId)).toMatchObject({ status: "batched", batch_id: target });
    const unheld = await rpc("ops_set_hold", { p_order_id: a.orderId, p_hold: false });
    expect(unheld.error?.hint).toBe("not_held");
    expect(await kinds(a.orderId)).toEqual(["submitted", "batched", "held", "moved"]);
  });
});

describe("factory status", () => {
  const batched = async () => {
    const o = await submit({ fabricKey: `s-${ref()}` });
    await cutAfter(o.orderId);
    return o.orderId;
  };

  it("moves one step at a time and never back, and an order at the factory cannot be held or moved", async () => {
    const id = await batched();
    expect((await rpc("ops_set_order_status", { p_order_id: id, p_to: "in_production" })).error?.hint).toBe("illegal_transition");
    for (const to of ["received", "in_production", "ready"]) must(await rpc("ops_set_order_status", { p_order_id: id, p_to: to }));
    expect((await row(id)).status).toBe("ready");
    expect((await rpc("ops_set_order_status", { p_order_id: id, p_to: "received" })).error?.hint).toBe("illegal_transition");
    expect((await rpc("ops_set_hold", { p_order_id: id, p_hold: true })).error?.hint).toBe("not_holdable");
    expect(await kinds(id)).toEqual(["submitted", "batched", "received", "in_production", "ready"]);
  });

  it("records a delay with its reason, only later, only with a reason", async () => {
    const [hh, mm] = String(savedSettings.cutoff_time).split(":").map(Number);
    must(await rpc("ops_update_settings", { p_weekday: savedSettings.cutoff_weekday, p_minutes: (hh ?? 0) * 60 + (mm ?? 0), p_lead_time_days: 14, p_label: "Test lead time" }));
    const id = await batched();
    const promised = (await row(id)).promised_on as string;
    expect(promised).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await rpc("ops_delay_order", { p_order_id: id, p_new_date: promised, p_reason: "Yarn late" })).error?.hint).toBe("not_later");
    expect((await rpc("ops_delay_order", { p_order_id: id, p_new_date: "2099-01-01", p_reason: " " })).error?.hint).toBe("reason_needed");
    must(await rpc("ops_delay_order", { p_order_id: id, p_new_date: "2099-01-01", p_reason: "Yarn late" }));
    expect((await row(id)).promised_on).toBe("2099-01-01");
    const events = must(await adminClient().from("ops_order_events").select("kind, note, promised_on").eq("order_id", id).eq("kind", "delayed")) as { note: string; promised_on: string }[];
    expect(events).toEqual([{ kind: "delayed", note: "Yarn late", promised_on: "2099-01-01" }]);
  });
});

describe("history and access", () => {
  it("can never be changed or removed: the server's key has no write grant on it", async () => {
    const o = await submit();
    expect((await adminClient().from("ops_order_events").update({ note: "x" }).eq("order_id", o.orderId)).error).not.toBeNull();
    expect((await adminClient().from("ops_order_events").delete().eq("order_id", o.orderId)).error).not.toBeNull();
    expect(must(await adminClient().from("ops_order_events").select("id").eq("order_id", o.orderId))).toHaveLength(1);
  });

  it("is read by platform admins, and by a member for their own brand only", async () => {
    const o = await submit();
    expect(must(await admin.client.from("ops_orders").select("id").eq("id", o.orderId))).toHaveLength(1);
    expect(must(await alice.client.from("ops_orders").select("id").eq("id", o.orderId))).toHaveLength(1);
    expect(must(await alice.client.from("ops_order_events").select("id").eq("order_id", o.orderId))).toHaveLength(1);
    expect(must(await bob.client.from("ops_orders").select("id").eq("id", o.orderId))).toHaveLength(0);
    expect(must(await bob.client.from("ops_order_events").select("id").eq("order_id", o.orderId))).toHaveLength(0);
  });

  it("keeps batches and settings from members, and lets no browser write anything", async () => {
    expect(must(await alice.client.from("batches").select("id"))).toHaveLength(0);
    expect(must(await alice.client.from("ops_settings").select("id"))).toHaveLength(0);
    expect(must(await admin.client.from("ops_settings").select("id"))).toHaveLength(1);
    for (const client of [alice.client, admin.client]) {
      expect((await client.from("ops_orders").update({ status: "ready" }).eq("brand_id", aliceBrand)).error).not.toBeNull();
      expect((await client.from("batches").insert({ factory_profile_id: "f", fabric_key: "f", article_id: "a", cutoff_at: new Date().toISOString() })).error).not.toBeNull();
      expect((await client.rpc("ops_cut_batches", { p_actor: admin.userId })).error).not.toBeNull();
    }
  });
});

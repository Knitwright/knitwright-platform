import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluateInspection, type ChecklistItem, type ChecklistResult } from "@/lib/ops/qc/checklist";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Ops console part 2 (decision 0050): the quality gate, packing, shipping and exceptions. Written to run against
 * `pnpm db:start`; the SQL was also run by hand against a bare Postgres 16 with stub tables (see the PR). Every table
 * here is read by platform admins only, and written only by functions the server's key runs.
 */

let alice: Person;
let admin: Person;
let aliceBrand: string;
let releaseId: string;
let savedSettings: Record<string, unknown>;

const ref = () => `qc-${Math.random().toString(36).slice(2)}`;
const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, { p_actor: admin.userId, ...args });
const KEYS = ["measurements", "colour", "artwork", "names_numbers"] as const;
const checklist = (over: Partial<Record<(typeof KEYS)[number], ChecklistResult>> = {}): ChecklistItem[] => KEYS.map((key) => ({ key, result: over[key] ?? "pass", note: "" }));
const GOOD = [{ point: "Chest", specMm: 520, measuredMm: 522, toleranceMm: 5 }];

beforeAll(async () => {
  [alice, admin] = await Promise.all([person("qc-alice"), person("qc-admin")]);
  aliceBrand = await brandOf(alice, "QC FC");
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  const project = must(await adminClient().rpc("create_project", { p_brand_id: aliceBrand, p_user_id: alice.userId, p_name: "Jersey", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;
  const created = must(await adminClient().rpc("create_release", { p_project_id: project, p_brand_id: aliceBrand, p_user_id: alice.userId, p_label: "QC round", p_snapshot: { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] }, p_file_specs: [], p_order_id: null })) as { id: string }[];
  releaseId = created[0]!.id;
  savedSettings = must(await adminClient().from("ops_settings").select("*").single()) as Record<string, unknown>;
});

afterAll(async () => {
  const [hh, mm] = String(savedSettings.cutoff_time).split(":").map(Number);
  await rpc("ops_update_settings", { p_weekday: savedSettings.cutoff_weekday, p_minutes: (hh ?? 0) * 60 + (mm ?? 0), p_lead_time_days: savedSettings.lead_time_days, p_label: savedSettings.label });
});

/** An order of 5 pieces (M 3, L 2) that the factory has marked ready. */
async function readyOrder(): Promise<string> {
  const rows = must(await adminClient().rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: ref(), p_factory_profile_id: `f-${ref()}`, p_fabric_key: "mesh", p_article_id: "crew-tee", p_sizes: { M: 3, L: 2 } })) as { order_id: string; cutoff_at: string }[];
  const id = rows[0]!.order_id;
  must(await rpc("ops_cut_batches", { p_now: new Date(Date.parse(rows[0]!.cutoff_at) + 1000).toISOString() }));
  for (const to of ["received", "in_production", "ready"]) must(await rpc("ops_set_order_status", { p_order_id: id, p_to: to }));
  return id;
}

const inspect = (orderId: string, over: Record<string, unknown> = {}) =>
  rpc("ops_record_inspection", { p_order_id: orderId, p_checklist: checklist(), p_measurements: GOOD, p_sample_size: 5, p_defect_count: 0, ...over });
const ship = (orderId: string, sizes: Record<string, number>, over: Record<string, unknown> = {}) =>
  rpc("ops_record_shipment", { p_order_id: orderId, p_courier: "DHL", p_tracking_number: "T1", p_shipped_on: "2026-10-30", p_sizes: sizes, ...over });
const REMAKE = { p_remake_sizes: { M: 1 }, p_remake_owner: "Sam", p_remake_due_on: "2099-01-01" };

describe("the quality gate", () => {
  it("refuses an inspection until the factory has marked the order ready", async () => {
    const rows = must(await adminClient().rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: ref(), p_factory_profile_id: "f", p_fabric_key: "m", p_article_id: "a", p_sizes: { M: 1 } })) as { order_id: string }[];
    expect((await inspect(rows[0]!.order_id)).error?.hint).toBe("not_ready_for_qc");
  });

  it("records a pass, and the database gives the result the TypeScript sum gives for each case", async () => {
    const cases: { name: string; checklist: ChecklistItem[]; measurements: typeof GOOD; defects: number }[] = [
      { name: "all good", checklist: checklist(), measurements: GOOD, defects: 0 },
      { name: "a box fails", checklist: checklist({ colour: "fail" }), measurements: GOOD, defects: 0 },
      { name: "a box not inspected", checklist: checklist({ artwork: "not_inspected" }), measurements: GOOD, defects: 0 },
      { name: "out of tolerance", checklist: checklist(), measurements: [{ ...GOOD[0]!, measuredMm: 530 }], defects: 0 },
      { name: "edge of tolerance", checklist: checklist(), measurements: [{ ...GOOD[0]!, measuredMm: 525 }], defects: 0 },
      { name: "a defect", checklist: checklist(), measurements: GOOD, defects: 1 },
      { name: "no measurement", checklist: checklist(), measurements: [], defects: 0 },
    ];
    for (const c of cases) {
      const id = await readyOrder();
      const expected = evaluateInspection({ checklist: c.checklist, measurements: c.measurements, defectCount: c.defects }).result;
      const out = await inspect(id, { p_checklist: c.checklist, p_measurements: c.measurements, p_defect_count: c.defects, ...(expected === "fail" ? REMAKE : {}) });
      expect(out.error, c.name).toBeNull();
      expect((out.data as { result: string }[])[0]!.result, c.name).toBe(expected);
    }
  });

  it("needs the remake for a fail, opens a remake line with an owner and a due date, and blocks shipping", async () => {
    const id = await readyOrder();
    expect((await inspect(id, { p_defect_count: 1 })).error?.hint).toBe("remake_needed");
    const out = must(await inspect(id, { p_defect_count: 1, ...REMAKE })) as { result: string; exception_id: string }[];
    expect(out[0]).toMatchObject({ result: "fail" });
    const exception = must(await adminClient().from("ops_exceptions").select("kind, status, owner, due_on, detail").eq("id", out[0]!.exception_id).single());
    expect(exception).toMatchObject({ kind: "remake", status: "open", owner: "Sam", due_on: "2099-01-01", detail: { M: 1 } });
    expect((await ship(id, { M: 3, L: 2 })).error?.hint).toBe("qc_not_passed");
  });

  it("lets the latest inspection decide, so a pass after a remake unblocks shipping", async () => {
    const id = await readyOrder();
    must(await inspect(id, { p_defect_count: 1, ...REMAKE }));
    must(await inspect(id));
    expect((await ship(id, { M: 3, L: 2 })).error).toBeNull();
  });

  it("refuses a malformed checklist or measurement by hint", async () => {
    const id = await readyOrder();
    expect((await inspect(id, { p_checklist: checklist().slice(1) })).error?.hint).toBe("invalid_checklist");
    expect((await inspect(id, { p_measurements: [{ point: "x", specMm: 1, measuredMm: 1 }] })).error?.hint).toBe("invalid_measurements");
    expect((await inspect(id, { p_sample_size: 2, p_defect_count: 3 })).error?.hint).toBe("invalid_input");
  });
});

describe("shipping", () => {
  it("refuses an order that has not been inspected, and over-shipping a size", async () => {
    const id = await readyOrder();
    expect((await ship(id, { M: 3, L: 2 })).error?.hint).toBe("qc_not_passed");
    must(await inspect(id));
    expect((await ship(id, { M: 4 })).error?.hint).toBe("over_shipped");
    expect((await ship(id, { XL: 1 })).error?.hint).toBe("over_shipped");
  });

  it("records a whole order as complete, and a part shipment only with an owner and a due date, which opens an exception", async () => {
    const id = await readyOrder();
    must(await inspect(id));
    expect((await ship(id, { M: 2 })).error?.hint).toBe("owner_and_due_needed");
    const part = must(await ship(id, { M: 2 }, { p_owner: "Sam", p_due_on: "2099-01-01" })) as { complete: boolean; shipped_pieces: number }[];
    expect(part[0]).toMatchObject({ complete: false, shipped_pieces: 2 });
    const kinds = must(await adminClient().from("ops_exceptions").select("kind").eq("order_id", id)) as { kind: string }[];
    expect(kinds).toEqual([{ kind: "partial_shipment" }]);
    const rest = must(await ship(id, { M: 1, L: 2 }, { p_tracking_number: "T2" })) as { complete: boolean }[];
    expect(rest[0]!.complete).toBe(true);
  });

  it("leaves the order's status as the factory set it", async () => {
    const id = await readyOrder();
    must(await inspect(id));
    must(await ship(id, { M: 3, L: 2 }));
    expect(must(await adminClient().from("ops_orders").select("status").eq("id", id).single())).toEqual({ status: "ready" });
  });
});

describe("packing", () => {
  it("makes bags, sets cartons with unset sizes as null, and packs a bag", async () => {
    const id = await readyOrder();
    expect(must(await rpc("ops_set_bags", { p_order_id: id, p_team_order_id: null, p_bags: [{ sizeLabel: "M", pieces: 3 }, { sizeLabel: "L", pieces: 2 }] }))).toBe(2);
    must(await rpc("ops_set_carton", { p_order_id: id, p_carton_no: 1, p_weight_g: null, p_length_mm: 400, p_width_mm: null, p_height_mm: null }));
    expect(must(await adminClient().from("ops_cartons").select("weight_g, length_mm, width_mm").eq("order_id", id).single())).toEqual({ weight_g: null, length_mm: 400, width_mm: null });
    const bag = must(await adminClient().from("ops_pack_bags").select("id").eq("order_id", id).eq("bag_no", 1).single()) as { id: string };
    expect((await rpc("ops_mark_bag_packed", { p_bag_id: bag.id, p_carton_no: 2 })).error?.hint).toBe("no_such_carton");
    must(await rpc("ops_mark_bag_packed", { p_bag_id: bag.id, p_carton_no: 1 }));
    expect((await rpc("ops_set_bags", { p_order_id: id, p_team_order_id: null, p_bags: [{ sizeLabel: "M", pieces: 5 }] })).error?.hint).toBe("already_packing");
  });

  it("refuses bags and cartons before the factory has the order, and bad sizes", async () => {
    const rows = must(await adminClient().rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: ref(), p_factory_profile_id: "f", p_fabric_key: "m", p_article_id: "a", p_sizes: { M: 1 } })) as { order_id: string }[];
    expect((await rpc("ops_set_carton", { p_order_id: rows[0]!.order_id, p_carton_no: 1, p_weight_g: 1, p_length_mm: 1, p_width_mm: 1, p_height_mm: 1 })).error?.hint).toBe("not_packable");
    const id = await readyOrder();
    expect((await rpc("ops_set_carton", { p_order_id: id, p_carton_no: 1, p_weight_g: 0, p_length_mm: null, p_width_mm: null, p_height_mm: null })).error?.hint).toBe("invalid_input");
    expect((await rpc("ops_set_bags", { p_order_id: id, p_team_order_id: null, p_bags: [{ sizeLabel: "", pieces: 1 }] })).error?.hint).toBe("invalid_bags");
  });
});

describe("exceptions", () => {
  it("need an owner and a due date, can be reassigned and resolved once, and keep their history", async () => {
    const id = await readyOrder();
    expect((await rpc("ops_raise_exception", { p_order_id: id, p_kind: "lost_parcel", p_owner: " ", p_due_on: "2099-01-01" })).error?.hint).toBe("owner_and_due_needed");
    expect((await rpc("ops_raise_exception", { p_order_id: id, p_kind: "remake", p_owner: "Sam", p_due_on: "2099-01-01" })).error?.hint).toBe("invalid_sizes");
    const e = must(await rpc("ops_raise_exception", { p_order_id: id, p_kind: "size_swap", p_owner: "Sam", p_due_on: "2099-01-01", p_detail: { from: "M", to: "L", pieces: 1 } })) as string;
    must(await rpc("ops_update_exception", { p_id: e, p_owner: "Jo", p_due_on: "2099-02-01", p_note: "moved" }));
    expect((await rpc("ops_resolve_exception", { p_id: e, p_resolution: " " })).error?.hint).toBe("resolution_needed");
    must(await rpc("ops_resolve_exception", { p_id: e, p_resolution: "Swapped" }));
    expect((await rpc("ops_resolve_exception", { p_id: e, p_resolution: "Again" })).error?.hint).toBe("already_resolved");
    expect((await rpc("ops_update_exception", { p_id: e, p_owner: "Jo", p_due_on: "2099-02-01" })).error?.hint).toBe("already_resolved");
    const history = must(await adminClient().from("ops_exception_events").select("kind").eq("exception_id", e).order("at").order("id")) as { kind: string }[];
    expect(history.map((h) => h.kind)).toEqual(["raised", "changed", "resolved"]);
  });
});

describe("history and access", () => {
  it("cannot be written or removed directly, even by the server's key, and keeps inspections and shipments append-only", async () => {
    const id = await readyOrder();
    must(await inspect(id));
    must(await ship(id, { M: 3, L: 2 }));
    for (const table of ["ops_qc_inspections", "ops_shipments", "ops_exception_events", "ops_exceptions", "ops_cartons", "ops_pack_bags"]) {
      expect((await adminClient().from(table).delete().eq("order_id", id)).error, `${table} delete`).not.toBeNull();
      expect((await adminClient().from(table).update({ note: "x" }).eq("order_id", id)).error, `${table} update`).not.toBeNull();
    }
    expect(must(await adminClient().from("ops_qc_inspections").select("id").eq("order_id", id))).toHaveLength(1);
  });

  it("is read by platform admins, and not even by a member of the order's own brand", async () => {
    const id = await readyOrder();
    must(await inspect(id));
    expect(must(await admin.client.from("ops_qc_inspections").select("id").eq("order_id", id))).toHaveLength(1);
    expect(must(await alice.client.from("ops_qc_inspections").select("id").eq("order_id", id))).toHaveLength(0);
    expect(must(await alice.client.from("ops_shipments").select("id").eq("order_id", id))).toHaveLength(0);
  });

  it("runs only for a platform admin as actor, and only for the server's key", async () => {
    const id = await readyOrder();
    const asMember = await adminClient().rpc("ops_record_inspection", { p_actor: alice.userId, p_order_id: id, p_checklist: checklist(), p_measurements: GOOD, p_sample_size: 1, p_defect_count: 0 });
    expect(asMember.error?.code).toBe("P0002");
    for (const client of [alice.client, admin.client]) {
      expect((await client.rpc("ops_record_shipment", { p_actor: admin.userId, p_order_id: id, p_courier: "x", p_tracking_number: "x", p_shipped_on: "2026-10-30", p_sizes: { M: 1 } })).error).not.toBeNull();
      expect((await client.rpc("ops_raise_exception", { p_actor: admin.userId, p_order_id: id, p_kind: "lost_parcel", p_owner: "x", p_due_on: "2099-01-01" })).error).not.toBeNull();
    }
  });
});

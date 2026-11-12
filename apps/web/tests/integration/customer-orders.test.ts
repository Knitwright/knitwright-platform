import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * What a brand's members see of an order after the factory has it (plan v6 P5, decision 0143): when it
 * passed QC, the QC photos ops chose to share, and each parcel's tracking. A member of another brand
 * sees nothing, and an inspection's photos stay hidden until ops shares them.
 */

let alice: Person;
let mallory: Person;
let admin: Person;
let releaseId: string;

const ref = () => `cust-${Math.random().toString(36).slice(2)}`;
const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, { p_actor: admin.userId, ...args });
const CHECKLIST = ["measurements", "colour", "artwork", "names_numbers"].map((key) => ({ key, result: "pass", note: "" }));
const PHOTO = "00000000-0000-4000-8000-000000000001";
const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };

beforeAll(async () => {
  [alice, mallory, admin] = await Promise.all([person("cust-alice"), person("cust-mallory"), person("cust-admin")]);
  const brand = await brandOf(alice, "Customer FC");
  await brandOf(mallory, "Other FC");
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  const project = must(await adminClient().rpc("create_project", { p_brand_id: brand, p_user_id: alice.userId, p_name: "Jersey", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;
  const created = must(await adminClient().rpc("create_release", { p_project_id: project, p_brand_id: brand, p_user_id: alice.userId, p_label: "Round 1", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  releaseId = created[0]!.id;
});

/** An order the factory has made, passed QC with one photo, and shipped. Its own factory id keeps its batch to itself. */
async function shippedOrder(): Promise<{ orderId: string; inspectionId: string }> {
  const rows = must(await adminClient().rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: ref(), p_factory_profile_id: `f-${ref()}`, p_fabric_key: "mesh", p_article_id: "crew-tee", p_sizes: { M: 2 } })) as { order_id: string; cutoff_at: string }[];
  const orderId = rows[0]!.order_id;
  must(await rpc("ops_cut_batches", { p_now: new Date(Date.parse(rows[0]!.cutoff_at) + 1000).toISOString() }));
  for (const to of ["received", "in_production", "ready"]) must(await rpc("ops_set_order_status", { p_order_id: orderId, p_to: to }));
  const inspected = must(await rpc("ops_record_inspection", { p_order_id: orderId, p_checklist: CHECKLIST, p_measurements: [{ point: "Chest", specMm: 520, measuredMm: 522, toleranceMm: 5 }], p_sample_size: 2, p_defect_count: 0, p_photo_file_ids: [PHOTO] })) as { inspection_id: string }[];
  must(await rpc("ops_record_shipment", { p_order_id: orderId, p_courier: "DHL", p_tracking_number: "TRACK1", p_shipped_on: "2026-11-02", p_sizes: { M: 2 } }));
  return { orderId, inspectionId: inspected[0]!.inspection_id };
}

type Tracking = { shipments: { courier: string; tracking_number: string; shipped_on: string; pieces: number }[]; inspections: { photo_file_ids: string[] }[] };

describe("an order's tracking, as its brand sees it", () => {
  it("gives the member the parcel and the passing inspection, with no photo until ops shares it", async () => {
    const { orderId, inspectionId } = await shippedOrder();
    const before = must(await alice.client.rpc("customer_order_tracking", { p_order_id: orderId })) as Tracking;
    expect(before.shipments).toMatchObject([{ courier: "DHL", tracking_number: "TRACK1", shipped_on: "2026-11-02", pieces: 2 }]);
    expect(before.inspections).toEqual([expect.objectContaining({ photo_file_ids: [] })]);

    must(await rpc("ops_share_qc_photos", { p_inspection_id: inspectionId, p_shared: true }));
    const after = must(await alice.client.rpc("customer_order_tracking", { p_order_id: orderId })) as Tracking;
    expect(after.inspections[0]!.photo_file_ids).toEqual([PHOTO]);
  });

  it("gives a member of another brand nothing", async () => {
    const { orderId } = await shippedOrder();
    expect(must(await mallory.client.rpc("customer_order_tracking", { p_order_id: orderId }))).toBeNull();
    expect(must(await mallory.client.rpc("customer_order_milestones", { p_order_ids: [orderId] }))).toEqual([]);
  });

  it("gives the milestones of the member's own orders", async () => {
    const { orderId } = await shippedOrder();
    const rows = must(await alice.client.rpc("customer_order_milestones", { p_order_ids: [orderId] })) as { order_id: string; qc_passed_at: string | null; shipped_on: string | null }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.qc_passed_at).not.toBeNull();
    expect(rows[0]!.shipped_on).toBe("2026-11-02");
  });
});

describe("sharing QC photos", () => {
  it("is for platform admins through the server's key, and changes nothing else about the inspection", async () => {
    const { inspectionId } = await shippedOrder();
    expect((await alice.client.rpc("ops_share_qc_photos", { p_actor: alice.userId, p_inspection_id: inspectionId, p_shared: true })).error).not.toBeNull();
    expect((await adminClient().rpc("ops_share_qc_photos", { p_actor: alice.userId, p_inspection_id: inspectionId, p_shared: true })).error).not.toBeNull();
    const change = await adminClient().from("ops_qc_inspections").update({ note: "changed" }).eq("id", inspectionId);
    expect(change.error).not.toBeNull();
  });
});

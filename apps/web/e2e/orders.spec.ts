import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { accessible } from "./chrome";
import { createAccount, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * Orders (plan v6 P5, decision 0143): a brand's order shows on /orders with its F-T7 status, and its
 * page shows the timeline, the parcel's tracking number and the QC photos ops chose to share. The
 * order reaches ops the way the Store would send it, as e2e/ops-qc.spec.ts does; every order here
 * takes its own factory id, so its batch is its own (plan v5, lesson 11).
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const ok = <T>(answer: { data: T; error: { message: string } | null }): T => {
  if (answer.error) throw new Error(answer.error.message);
  return answer.data;
};

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };
const CHECKLIST = ["measurements", "colour", "artwork", "names_numbers"].map((key) => ({ key, result: "pass", note: "" }));

/** An order of the member's brand that passed QC with one photo and shipped. Returns its id. */
async function shippedOrder(memberEmail: string, opsEmail: string, design: string): Promise<string> {
  const db = service();
  const [userId, actor] = await Promise.all([userIdOf(memberEmail), userIdOf(opsEmail)]);
  const brandId = (ok(await db.from("memberships").select("brand_id").eq("user_id", userId).limit(1).single()) as { brand_id: string }).brand_id;
  const project = ok(await db.rpc("create_project", { p_brand_id: brandId, p_user_id: userId, p_name: design, p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 }));
  const release = ok(await db.rpc("create_release", { p_project_id: project, p_brand_id: brandId, p_user_id: userId, p_label: "Round 1", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  const ref = `E2E-ORDERS-${randomUUID()}`;
  ok(await db.rpc("submit_order_for_production", { p_release_id: release[0]!.id, p_external_ref: ref, p_factory_profile_id: `f-${randomUUID().slice(0, 8)}`, p_fabric_key: "mesh-140", p_article_id: "crew-tee", p_sizes: { M: 3, L: 2 } }));
  const placed = ok(await db.from("ops_orders").select("id, cutoff_at").eq("external_ref", ref).single()) as { id: string; cutoff_at: string };
  ok(await db.rpc("ops_cut_batches", { p_actor: actor, p_now: new Date(Date.parse(placed.cutoff_at) + 1000).toISOString() }));
  for (const to of ["received", "in_production", "ready"]) ok(await db.rpc("ops_set_order_status", { p_actor: actor, p_order_id: placed.id, p_to: to }));
  const inspected = ok(await db.rpc("ops_record_inspection", { p_actor: actor, p_order_id: placed.id, p_checklist: CHECKLIST, p_measurements: [], p_sample_size: 5, p_defect_count: 0, p_photo_file_ids: [randomUUID()] })) as { inspection_id: string }[];
  ok(await db.rpc("ops_share_qc_photos", { p_actor: actor, p_inspection_id: inspected[0]!.inspection_id, p_shared: true }));
  ok(await db.rpc("ops_record_shipment", { p_actor: actor, p_order_id: placed.id, p_courier: "DHL", p_tracking_number: "TRACK-E2E-1", p_shipped_on: "2026-11-02", p_sizes: { M: 3, L: 2 } }));
  return placed.id;
}

test.describe("the Orders area", () => {
  test("lists a shipped order and its page shows the tracking and the shared QC photo", async ({ page }) => {
    const member = await createAccount("orders-member", { brand: "Orders FC" });
    const ops = await createAccount("orders-ops");
    await makePlatformAdmin(ops);
    const design = `Orders jersey ${randomUUID().slice(0, 8)}`;
    const orderId = await shippedOrder(member, ops, design);

    await signIn(page, member);
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Save on team and bulk orders" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: design });
    await expect(row.getByText("Shipped")).toBeVisible();
    await accessible(page);

    // The chips filter; Cancelled matches nothing yet and shows the empty state.
    await page.getByRole("navigation", { name: "Order status" }).getByRole("link", { name: "Cancelled" }).click();
    await expect(page.getByRole("heading", { name: "No orders here yet" })).toBeVisible();

    await page.goto("/orders");
    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(design) })).toBeVisible();
    await expect(page.getByRole("list", { name: "Where this order is" }).getByText("Shipped")).toBeVisible();
    await expect(page.getByText("TRACK-E2E-1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open QC photo 1" })).toBeVisible();
    await expect(page.getByText(/No delivery date yet|Delivery by/)).toBeVisible();
    await accessible(page);
  });

  test("an order of another brand is a page that does not exist, and the tabs all open", async ({ page }) => {
    const owner = await createAccount("orders-owner", { brand: "Owner FC" });
    const ops = await createAccount("orders-ops-2");
    await makePlatformAdmin(ops);
    const orderId = await shippedOrder(owner, ops, `Hidden jersey ${randomUUID().slice(0, 8)}`);

    const stranger = await createAccount("orders-stranger", { brand: "Stranger FC" });
    await signIn(page, stranger);
    await expect(page).toHaveURL(/\/studio$/);
    expect((await page.goto(`/orders/${orderId}`))?.status()).toBe(404);

    for (const [tab, heading] of [["Samples", "No samples yet"], ["Collection plans", "No collection plan yet"], ["Quotes", "Nothing to quote yet"]] as const) {
      await page.goto("/orders");
      await page.getByRole("navigation", { name: "Orders", exact: true }).getByRole("link", { name: tab }).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});

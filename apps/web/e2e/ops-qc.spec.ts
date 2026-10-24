import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * Decision 0050, ops console part 2: an order the factory has marked ready goes through the quality gate to shipped.
 * The order reaches ops the way the Store would send it (e2e/ops.spec.ts does the same); the rest is the screens.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

/** A ready order of 5 pieces (M 3, L 2) for a brand the account owns. Returns its id. */
async function readyOrder(email: string, ref: string): Promise<string> {
  const db = service();
  const userId = await userIdOf(email);
  const membership = await db.from("memberships").select("brand_id").eq("user_id", userId).limit(1).single();
  const brandId = membership.data?.brand_id as string;
  const project = await db.rpc("create_project", { p_brand_id: brandId, p_user_id: userId, p_name: "QC jersey", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 });
  if (project.error) throw new Error(project.error.message);
  const release = await db.rpc("create_release", { p_project_id: project.data, p_brand_id: brandId, p_user_id: userId, p_label: "QC round", p_snapshot: { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] }, p_file_specs: [], p_order_id: null });
  if (release.error) throw new Error(release.error.message);
  const submitted = await db.rpc("submit_order_for_production", { p_release_id: (release.data as { id: string }[])[0]?.id, p_external_ref: ref, p_factory_profile_id: "knitwright-default", p_fabric_key: "mesh-140", p_article_id: "crew-tee", p_sizes: { M: 3, L: 2 } });
  if (submitted.error) throw new Error(submitted.error.message);
  const placed = await db.from("ops_orders").select("id, cutoff_at").eq("external_ref", ref).single();
  if (placed.error) throw new Error(placed.error.message);
  const cut = await db.rpc("ops_cut_batches", { p_actor: userId, p_now: new Date(Date.parse(placed.data.cutoff_at as string) + 1000).toISOString() });
  if (cut.error) throw new Error(cut.error.message);
  for (const to of ["received", "in_production", "ready"]) {
    const step = await db.rpc("ops_set_order_status", { p_actor: userId, p_order_id: placed.data.id, p_to: to });
    if (step.error) throw new Error(step.error.message);
  }
  return placed.data.id as string;
}

test.describe("the ops console, quality control to shipped", () => {
  test("the new pages do not exist for a member", async ({ page }) => {
    const id = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
    const email = await createAccount("ops-qc-member");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    for (const path of ["/ops/exceptions", `/ops/orders/${id}/qc`, `/ops/orders/${id}/packing`, `/ops/orders/${id}/shipping`]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
    expect((await page.request.get(`/api/ops/orders/${id}/packing-list`)).status()).toBe(404);
  });

  test("a failed inspection blocks shipping and opens a remake; a pass lets the order ship", async ({ page }) => {
    const email = await createAccount("ops-qc-admin");
    await makePlatformAdmin(email);
    const ref = `E2E-QC-${Date.now()}`;
    const orderId = await readyOrder(email, ref);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    // Nothing is inspected yet, so shipping says so.
    await page.goto(`/ops/orders/${orderId}/shipping`);
    await expect(page.getByTestId("ship-blocker")).toContainText("has not been inspected");

    // A fail: one defective piece. The form asks for the remake.
    await page.goto(`/ops/orders/${orderId}/qc`);
    const fill = async (defects: string) => {
      for (const label of ["Result: measurements against the size spec, on a sample", "Result: colour against the swatch", "Result: artwork placement", "Result: names and numbers against the team list"]) {
        await page.getByLabel(label).selectOption("pass");
      }
      await page.getByLabel("Measurement lines").fill("Chest width, 520, 522, 5");
      await page.getByLabel("Pieces inspected").fill("5");
      await page.getByLabel("Pieces with a defect").fill(defects);
    };
    await fill("1");
    await page.getByRole("button", { name: "Record inspection" }).click();
    await expect(page.getByText(/This inspection fails/)).toBeVisible();
    // A rejected form is cleared by the framework, so fill it in again with the remake.
    await fill("1");
    await page.getByLabel("Remake pieces by size").fill("M 1");
    await page.getByLabel("Remake owner").fill("Sam");
    await page.getByLabel("Remake due date").fill("2099-01-01");
    await page.getByRole("button", { name: "Record inspection" }).click();
    await expect(page.getByText("Inspection recorded: fail")).toBeVisible();
    await expect(page.getByTestId("remake-line")).toContainText("M ×1");

    await page.goto(`/ops/orders/${orderId}/shipping`);
    await expect(page.getByTestId("ship-blocker")).toContainText("failed");

    await page.goto("/ops/exceptions");
    await expect(page.getByTestId("exception").filter({ hasText: "Remake" }).first()).toContainText("owner Sam");

    // A pass after the remake.
    await page.goto(`/ops/orders/${orderId}/qc`);
    await fill("0");
    await page.getByRole("button", { name: "Record inspection" }).click();
    await expect(page.getByText("Inspection recorded: pass")).toBeVisible();

    // Packing: bags and a carton with no invented numbers.
    await page.goto(`/ops/orders/${orderId}/packing`);
    await page.getByRole("button", { name: "Make the bags" }).click();
    await expect(page.getByTestId("bag").first()).toBeVisible();
    const list = await page.request.get(`/api/ops/orders/${orderId}/packing-list`);
    expect(list.status()).toBe(200);
    expect(list.headers()["content-type"]).toBe("application/pdf");
    expect((await list.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Shipping: a part shipment needs an owner for the rest, then the rest completes the order.
    await page.goto(`/ops/orders/${orderId}/shipping`);
    await page.getByLabel("Courier").fill("DHL");
    await page.getByLabel("Tracking number").fill("TRACK-1");
    await page.getByLabel("Shipped on").fill("2026-10-30");
    await page.getByLabel("Pieces sent, by size").fill("M 3");
    await page.getByRole("button", { name: "Record parcel" }).click();
    await expect(page.locator("[data-form-summary]")).toBeVisible();
    await page.getByLabel("Owner of the rest").fill("Sam");
    await page.getByLabel("Due date for the rest").fill("2099-01-01");
    await page.getByRole("button", { name: "Record parcel" }).click();
    await expect(page.getByTestId("fulfilment")).toContainText("Part shipped");
    await page.getByLabel("Courier").fill("DHL");
    await page.getByLabel("Shipped on").fill("2026-10-31");
    await page.getByLabel("Tracking number").fill("TRACK-2");
    await page.getByLabel("Pieces sent, by size").fill("L 2");
    await page.getByRole("button", { name: "Record parcel" }).click();
    await expect(page.getByTestId("fulfilment")).toContainText("Shipped");
    await expect(page.getByTestId("parcel")).toHaveCount(2);
  });

  test("the home screen shows the numbers from the tables", async ({ page }) => {
    const email = await createAccount("ops-qc-home");
    await makePlatformAdmin(email);
    await readyOrder(email, `E2E-HOME-${Date.now()}`);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/ops");
    await expect(page.getByText("Orders this week")).toBeVisible();
    await expect(page.getByText("Next cut-off")).toBeVisible();
    await expect(page.getByText("Defect rate by factory")).toBeVisible();
  });
});

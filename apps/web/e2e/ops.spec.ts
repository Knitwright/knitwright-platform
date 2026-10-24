import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * Decision 0043, the ops console: a page that does not exist for everyone but a platform admin, and for
 * an admin the whole of part 1 from the Store's door to the factory sheet and the status steps.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const PATHS = ["/ops", "/ops/settings", "/ops/batches/6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", "/ops/orders/6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11"];

/** A release for a brand the account owns, then an order for it, the way the Store would submit one. */
async function submitOrder(email: string, ref: string): Promise<void> {
  const db = service();
  const userId = await userIdOf(email);
  const membership = await db.from("memberships").select("brand_id").eq("user_id", userId).limit(1).single();
  const brandId = membership.data?.brand_id as string;
  const project = await db.rpc("create_project", { p_brand_id: brandId, p_user_id: userId, p_name: "Ops jersey", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 });
  if (project.error) throw new Error(project.error.message);
  const release = await db.rpc("create_release", { p_project_id: project.data, p_brand_id: brandId, p_user_id: userId, p_label: "Round 1 jerseys", p_snapshot: { specVersion: 1, rosterHash: null, files: [] }, p_file_specs: [], p_order_id: null });
  if (release.error) throw new Error(release.error.message);
  const submitted = await db.rpc("submit_order_for_production", { p_release_id: (release.data as { id: string }[])[0]?.id, p_external_ref: ref, p_factory_profile_id: "knitwright-default", p_fabric_key: "mesh-140", p_article_id: "crew-tee", p_sizes: { M: 3, L: 2 } });
  if (submitted.error) throw new Error(submitted.error.message);
  // The test cannot wait for Friday: cut the batches as of just after this order's cut-off, as ops would on the day.
  const placed = await db.from("ops_orders").select("cutoff_at").eq("external_ref", ref).single();
  if (placed.error) throw new Error(placed.error.message);
  const cut = await db.rpc("ops_cut_batches", { p_actor: userId, p_now: new Date(Date.parse(placed.data.cutoff_at as string) + 1000).toISOString() });
  if (cut.error) throw new Error(cut.error.message);
}

test.describe("the ops console", () => {
  test("does not exist for a visitor or a member", async ({ page }) => {
    for (const path of PATHS) expect((await page.goto(path))?.status(), path).toBe(404);
    const email = await createAccount("ops-member");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    for (const path of PATHS) expect((await page.goto(path))?.status(), path).toBe(404);
    const api = await page.request.get("/api/ops/batches/6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11/factory-sheet");
    expect(api.status()).toBe(404);
  });

  test("is not linked from the studio", async ({ page }) => {
    const email = await createAccount("ops-nolink");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/studio");
    await expect(page.locator('a[href^="/ops"]')).toHaveCount(0);
  });

  test("takes an order from the Store to a batch, a factory sheet and the factory steps", async ({ page }) => {
    const email = await createAccount("ops-admin");
    await makePlatformAdmin(email);
    const ref = `E2E-${Date.now()}`;
    await submitOrder(email, ref);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: "Batches", exact: true })).toBeVisible();
    // The order was already cut into a batch by the setup, so nothing is waiting and the button says so.
    await expect(page.getByTestId("waiting-order").filter({ hasText: ref })).toHaveCount(0);
    await page.getByRole("button", { name: "Cut batches now" }).click();
    await expect(page.getByText("No order was waiting past its cut-off.")).toBeVisible();

    await page.getByRole("link", { name: /crew-tee, mesh-140/ }).first().click();
    await expect(page.getByTestId("batch-order").filter({ hasText: ref })).toBeVisible();
    const sheet = await page.request.get(page.url().replace("/ops/batches/", "/api/ops/batches/") + "/factory-sheet");
    expect(sheet.status()).toBe(200);
    expect(sheet.headers()["content-type"]).toBe("application/pdf");
    expect((await sheet.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const zip = await page.request.get(page.url().replace("/ops/batches/", "/api/ops/batches/") + "/print-files");
    expect(zip.headers()["content-type"]).toBe("application/zip");

    await page.getByRole("link", { name: ref }).click();
    await page.getByRole("button", { name: /Mark received/i }).click();
    await expect(page.getByText("Received by the factory").first()).toBeVisible();
    await page.getByLabel("New promised date").fill("2099-01-01");
    await page.getByLabel("Why it is late").fill("Yarn delivery late");
    await page.getByRole("button", { name: "Delay" }).click();
    await expect(page.getByTestId("order-event").filter({ hasText: "Yarn delivery late" })).toBeVisible();
  });
});

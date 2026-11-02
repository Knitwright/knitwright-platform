import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * Ops completion (plan v5 O1, decision 0100): the sampling plan and the typed Delta-E reading on the quality
 * screen, the third-party inspection, the commercial invoice, the customer's status message, and the factory
 * scorecard.
 *
 * **Every order here gets its own fabric key.** `ops_cut_batches` groups by factory, fabric, article and
 * cut-off and reuses a batch it has already cut, so a shared fabric would hand this spec another spec's batch.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const ok = <T extends { error: { message: string } | null }>(result: T): T => {
  if (result.error) throw new Error(result.error.message);
  return result;
};

/** A ready order of 400 pieces on its own fabric, so a third-party inspection is offered on it. */
async function readyOrder(email: string, ref: string): Promise<string> {
  const db = service();
  const userId = await userIdOf(email);
  const membership = ok(await db.from("memberships").select("brand_id").eq("user_id", userId).limit(1).single());
  const brandId = membership.data?.brand_id as string;
  const project = ok(await db.rpc("create_project", { p_brand_id: brandId, p_user_id: userId, p_name: "O1 jersey", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 }));
  const release = ok(
    await db.rpc("create_release", {
      p_project_id: project.data, p_brand_id: brandId, p_user_id: userId, p_label: "O1 round",
      p_snapshot: { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] },
      p_file_specs: [], p_order_id: null,
    }),
  );
  ok(
    await db.rpc("submit_order_for_production", {
      p_release_id: (release.data as { id: string }[])[0]?.id, p_external_ref: ref,
      p_factory_profile_id: `o1-factory-${ref.toLowerCase()}`, p_fabric_key: `o1-fabric-${ref.toLowerCase()}`,
      p_article_id: "crew-tee", p_sizes: { M: 200, L: 200 }, p_value_minor: 1_160_000, p_currency: "GBP",
    }),
  );
  const placed = ok(await db.from("ops_orders").select("id, cutoff_at").eq("external_ref", ref).single());
  const order = placed.data as { id: string; cutoff_at: string };
  ok(await db.rpc("ops_cut_batches", { p_actor: userId, p_now: new Date(Date.parse(order.cutoff_at) + 1000).toISOString() }));
  for (const to of ["received", "in_production", "ready"]) ok(await db.rpc("ops_set_order_status", { p_actor: userId, p_order_id: order.id, p_to: to }));
  return order.id;
}

test.describe("ops completion", () => {
  test("the scorecard and the invoice do not exist for a member", async ({ page }) => {
    const id = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
    const email = await createAccount("o1-member");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    expect((await page.goto("/ops/scorecard"))?.status()).toBe(404);
    expect((await page.request.get(`/api/ops/orders/${id}/commercial-invoice`)).status()).toBe(404);
  });

  test("the scheduled cut answers only the scheduler", async ({ page }) => {
    // No CRON_SECRET is set where the browser tests run, so the job is switched off rather than open.
    const answer = await page.request.get("/api/cron/ops-cut-batches");
    expect([404, 503]).toContain(answer.status());
  });

  test("the quality screen shows the plan, takes a colour reading and offers an inspection", async ({ page }) => {
    const email = await createAccount("o1-qc-admin");
    await makePlatformAdmin(email);
    const ref = `E2E-O1-${Date.now()}`;
    const orderId = await readyOrder(email, ref);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto(`/ops/orders/${orderId}/qc`);
    // 400 pieces falls in the 281-500 band: code letter H, 50 pieces, and the plan says it is not sourced.
    await expect(page.getByTestId("aql-plan")).toContainText("Code letter H, 50 pieces inspected out of 400");
    await expect(page.getByTestId("aql-unsourced")).toContainText("ISO 2859-1");

    // A reading is typed in. The factory is not on file, so nothing judges it and the inspection still passes.
    for (const label of ["Result: measurements against the size spec, on a sample", "Result: colour against the swatch", "Result: artwork placement", "Result: names and numbers against the team list"]) {
      await page.getByLabel(label).selectOption("pass");
    }
    await page.getByLabel("Measurement lines").fill("Chest width, 520, 522, 5");
    await page.getByLabel("Colour readings").fill("Kit navy, 1.2");
    await page.getByLabel("Pieces inspected").fill("50");
    await page.getByLabel("Pieces with a defect").fill("0");
    await page.getByRole("button", { name: "Record inspection" }).click();
    await expect(page.getByText("Inspection recorded: pass")).toBeVisible();
    await expect(page.getByTestId("colour-reading")).toContainText("Kit navy reads Delta-E 1.2");

    // A run over 300 pieces may be inspected by a third party. Nothing is booked, and it says so.
    await page.getByRole("button", { name: "Ask for an inspection" }).click();
    await expect(page.getByTestId("inspection-booking")).toContainText("Nothing booked");
  });

  test("the invoice is issued, printed from the record, and the customer's message is written", async ({ page }) => {
    const email = await createAccount("o1-ship-admin");
    await makePlatformAdmin(email);
    const ref = `E2E-O1I-${Date.now()}`;
    const orderId = await readyOrder(email, ref);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto(`/ops/orders/${orderId}/shipping`);
    // The factory of this order is not on file, so the invoice names the gate instead of guessing an origin.
    await page.getByLabel("Country the goods are going to").selectOption("GB");
    await page.getByLabel("Invoice date").fill("2026-12-07");
    await page.getByRole("button", { name: "Issue the invoice" }).click();
    await expect(page.locator("[data-form-summary]")).toContainText("/ops/factories");

    // The customer's message is written from the order and states no delivery date.
    await page.goto(`/ops/orders/${orderId}`);
    await page.getByLabel("Customer's email address").fill("club@example.com");
    await page.getByRole("button", { name: /Write the message|Send the message/ }).click();
    await expect(page.getByTestId("email-body")).toContainText("not giving you a delivery date yet");
    await expect(page.getByTestId("customer-email").first()).toContainText("Not sent");
  });

  test("the scorecard says which factory is not active, and why", async ({ page }) => {
    const email = await createAccount("o1-score-admin");
    await makePlatformAdmin(email);
    // This spec's own factory, so the card it reads is nobody else's and is unique on a retry.
    const name = `O1 scorecard factory ${Date.now()}`;
    ok(
      await service()
        .from("factories")
        .insert({ slug: `o1-score-${Date.now()}`, name, city: "Sialkot", country: "PK", time_zone: "Asia/Karachi", label: "Made by the O1 browser test" })
        .select("slug"),
    );
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/ops/scorecard");
    await expect(page.getByRole("heading", { level: 1, name: "Factory scorecard" })).toBeVisible();
    const card = page.getByTestId("scorecard").filter({ hasText: name });
    await expect(card.getByTestId("scorecard-state")).toHaveText("Not active");
    await expect(card.getByTestId("scorecard-warnings")).toContainText("active only with one");
    await expect(page.getByText("No acceptable defect rate is agreed")).toBeVisible();
  });
});

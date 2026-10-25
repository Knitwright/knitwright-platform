import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAccount, createColleagueOf, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * Plan W4-C (decision 0062): a small brand lists a design as a product, orders a sample of one piece per size, moves the product
 * on, orders a run from a size breakdown (flagged when under the minimum or over 300) and sees both in the ops queue.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const id = /\/studio\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!id) throw new Error(`No design id in ${page.url()}`);
  return id;
};

/** Freezes a release of the design the way the server does, so the test does not need print files. */
async function freeze(email: string, projectId: string): Promise<void> {
  const db = service();
  const userId = await userIdOf(email);
  const brand = await db.from("projects").select("brand_id").eq("id", projectId).single();
  if (brand.error) throw new Error(brand.error.message);
  const release = await db.rpc("create_release", { p_project_id: projectId, p_brand_id: brand.data.brand_id, p_user_id: userId, p_label: "Round 1", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null });
  if (release.error) throw new Error(release.error.message);
}

/** Types pieces into the first sizes of the builder. A design with no size run gets the sizes S and M added first. */
const fillSizes = async (builder: ReturnType<Page["getByRole"]>, pieces: readonly string[]): Promise<void> => {
  const boxes = builder.getByPlaceholder("0");
  if ((await boxes.count()) === 0) {
    for (const label of ["S", "M"]) {
      await builder.getByLabel("Size label", { exact: true }).fill(label);
      await builder.getByRole("button", { name: "Add size" }).click();
    }
  }
  for (const [index, value] of pieces.entries()) await boxes.nth(index).fill(value);
};

test.describe("brand workspace (W4-C)", () => {
  test("a product goes from idea to sample to run and both orders reach the ops queue", async ({ page }) => {
    const email = await createAccount("brand-runs", { brand: "Fern Apparel" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Fern hoodie");
    await freeze(email, projectId);

    await page.getByRole("link", { name: "Brand", exact: true }).first().click();
    await expect(page).toHaveURL(/\/brand$/);
    const products = page.getByRole("region", { name: "Product list" });
    await products.getByLabel("Design to list").selectOption({ label: "Fern hoodie" });
    await products.getByRole("button", { name: "Add to product list" }).click();
    await expect(page).toHaveURL(/\/brand\?product=/);
    await expect(products.getByText("Idea ·")).toBeVisible();

    // A run is not possible before a sample.
    const builder = page.getByRole("region", { name: "Run builder" });
    await expect(builder.getByRole("option", { name: "Brand run" })).toBeDisabled();

    // A sample: one piece per size. Two pieces of a size is refused before it is sent.
    await builder.getByLabel("Fabric").fill("Mesh 140");
    await fillSizes(builder, ["2", "1"]);
    await expect(builder.getByText("a sample is one piece of each size")).toBeVisible();
    await expect(builder.getByRole("button", { name: "Order sample" })).toBeDisabled();
    await fillSizes(builder, ["1"]);
    await expect(builder.getByText("Total: 2 pieces")).toBeVisible();
    await expect(builder.getByText("Price of a sample: Knitwright will quote.")).toBeVisible();
    await builder.getByRole("button", { name: "Order sample" }).click();
    await expect(builder.getByRole("alert")).toHaveCount(0);

    const sent = page.getByRole("region", { name: "Sent to ops" });
    await expect(sent.getByText(/Fern hoodie · Sample · 2 pieces/)).toBeVisible();
    await expect(sent.getByText(/in ops: submitted/)).toBeVisible();

    // The brand moves the product on, twice.
    await products.getByRole("button", { name: "Move to sample stage" }).click();
    await expect(products.getByText("Fern hoodie is now at the sample stage.")).toBeVisible();
    await products.getByRole("button", { name: "Happy with the sample, move to run stage" }).click();
    await expect(products.getByText("Fern hoodie is now at the run stage.")).toBeVisible();

    // A run under the factory's minimum: the minimum is not set, so it is flagged and needs the brand's say-so.
    await expect(builder.getByRole("option", { name: "Sample: one piece per size" })).toBeDisabled();
    // Moving the stage opens a fresh builder, so the fabric is named again.
    await builder.getByLabel("Fabric").fill("Mesh 140");
    await fillSizes(builder, ["20", "40"]);
    await expect(builder.getByText("Total: 60 pieces")).toBeVisible();
    await expect(builder.getByText("Price: Knitwright will quote.")).toBeVisible();
    await expect(builder.getByText("No minimum order is set for this garment yet")).toBeVisible();
    await expect(builder.getByRole("button", { name: "Order run" })).toBeDisabled();
    await builder.getByLabel("I have read these notes and want to send this anyway.").check();
    await builder.getByRole("button", { name: "Order run" }).click();
    await expect(builder.getByRole("alert")).toHaveCount(0);
    await expect(sent.getByText(/Fern hoodie · Brand run · 60 pieces/)).toBeVisible();
    await expect(sent.getByText(/in ops: submitted/)).toHaveCount(2);
    await expect(sent.getByText(/Sent with notes: No minimum order is set/)).toBeVisible();
  });

  test("both orders show in the ops queue for a platform admin", async ({ page }) => {
    const email = await createAccount("brand-runs-ops", { brand: "Birch Apparel" });
    await makePlatformAdmin(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Birch tee");
    await freeze(email, projectId);
    const db = service();
    const userId = await userIdOf(email);
    const brand = await db.from("projects").select("brand_id").eq("id", projectId).single();
    const brandId = brand.data?.brand_id as string;
    await page.goto("/brand");
    const products = page.getByRole("region", { name: "Product list" });
    await products.getByLabel("Design to list").selectOption({ label: "Birch tee" });
    await products.getByRole("button", { name: "Add to product list" }).click();
    const builder = page.getByRole("region", { name: "Run builder" });
    await builder.getByLabel("Fabric").fill("Birch mesh");
    await fillSizes(builder, ["1"]);
    await builder.getByRole("button", { name: "Order sample" }).click();
    await expect(builder.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Sent to ops" }).getByText(/in ops: submitted/)).toBeVisible();

    const order = await db.from("ops_orders").select("external_ref, cutoff_at").eq("brand_id", brandId).single();
    if (order.error) throw new Error(order.error.message);
    expect(order.data.external_ref).toContain("brand-run:");
    const cut = await db.rpc("ops_cut_batches", { p_actor: userId, p_now: new Date(Date.parse(order.data.cutoff_at as string) + 1000).toISOString() });
    if (cut.error) throw new Error(cut.error.message);

    await page.goto("/ops");
    await page.getByRole("link", { name: /crew-tee, Birch mesh/ }).first().click();
    await expect(page.getByTestId("batch-order").filter({ hasText: "brand-run:" })).toBeVisible();
  });

  test("a viewer sees the list and cannot add or order", async ({ page, browser }) => {
    const ownerEmail = await createAccount("brand-runs-owner", { brand: "Cedar Apparel" });
    await signIn(page, ownerEmail);
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Cedar tee");
    const viewerEmail = await createColleagueOf(ownerEmail, "brand-runs-viewer");
    const db = service();
    const demoted = await db.from("memberships").update({ role: "viewer" }).eq("user_id", await userIdOf(viewerEmail));
    expect(demoted.error).toBeNull();
    await page.goto("/brand");
    const products = page.getByRole("region", { name: "Product list" });
    await products.getByLabel("Design to list").selectOption({ label: "Cedar tee" });
    await products.getByRole("button", { name: "Add to product list" }).click();
    await expect(page).toHaveURL(/\/brand\?product=/);
    const productUrl = page.url();

    const other = await browser.newContext();
    const viewerPage = await other.newPage();
    await signIn(viewerPage, viewerEmail);
    await expect(viewerPage).toHaveURL(/\/studio$/);
    await viewerPage.goto(productUrl);
    await expect(viewerPage.getByRole("region", { name: "Product list" }).getByText("Cedar tee").first()).toBeVisible();
    await expect(viewerPage.getByRole("button", { name: "Add to product list" })).toHaveCount(0);
    await expect(viewerPage.getByText("Only owners, admins and kit managers can place orders.")).toBeVisible();
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
    await other.close();
  });
});

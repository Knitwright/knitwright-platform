import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAccount, openTool, signIn, test, userIdOf } from "./support";

/**
 * Make (plan v5 Y7, F-S7): the product-created page, a sample of one piece per size, the golden sample the founder
 * signs off, and "Select sizes" handing a run over to production.
 *
 * The run gate is the acceptance test of F-S7: before the sign-off the page refuses a run and says why; after it,
 * the same product may be ordered.
 *
 * Every design here gives itself its own name and its own fabric, because the orders of the whole suite share one
 * database and ops batches group by factory, fabric, article and cut-off (plan v5, lesson 11).
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const snapshotOf = (specVersion: number) => ({
  specVersion,
  patternBlockId: "crew-tee",
  patternBlockVersion: 1,
  fabricTestIds: [],
  printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" },
  rosterHash: null,
  files: [],
});

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const id = /\/studio\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!id) throw new Error(`No design id in ${page.url()}`);
  // A new design holds no size run until the sizes are saved, and the make pages offer the sizes the design has.
  await openTool(page, "Sizes");
  await page.getByRole("button", { name: "Change sizes" }).click();
  await expect(page.getByTestId("save-status")).toHaveText("Saved as version 2.");
  return id;
};

/** Freezes a release and lists the design as a product, the way the server does, and leaves a picture to attach. */
async function prepare(email: string, projectId: string, name: string): Promise<void> {
  const db = service();
  const userId = await userIdOf(email);
  const project = await db.from("projects").select("brand_id").eq("id", projectId).single();
  if (project.error) throw new Error(project.error.message);
  const brandId = project.data.brand_id as string;
  const project2 = await db.from("projects").select("current_version").eq("id", projectId).single();
  if (project2.error) throw new Error(project2.error.message);
  // The release freezes the version the design is at now, so the golden sample is cut from the version being made.
  const release = await db.rpc("create_release", { p_project_id: projectId, p_brand_id: brandId, p_user_id: userId, p_label: "Round 1", p_snapshot: snapshotOf(project2.data.current_version as number), p_file_specs: [], p_order_id: null });
  if (release.error) throw new Error(release.error.message);
  const product = await db.rpc("create_brand_product", { p_brand_id: brandId, p_user_id: userId, p_project_id: projectId, p_name: name });
  if (product.error) throw new Error(product.error.message);
  const picture = await db.from("files").insert({
    brand_id: brandId, bucket: "uploads", path: `${brandId}/make/${randomUUID()}.png`, kind: "photo", content_type: "image/png", bytes: 10, created_by: userId,
  });
  if (picture.error) throw new Error(picture.error.message);
}

test.describe("make (Y7)", () => {
  test("a product is sampled, its golden sample is signed off, and only then can a run be ordered", async ({ page }) => {
    const email = await createAccount("make", { brand: "Fern Make" });
    await signIn(page, email);
    // The session cookie arrives with the redirect: follow it before asking for a guarded page.
    await expect(page).toHaveURL(/\/studio$/);

    const name = `Make tee ${randomUUID().slice(0, 8)}`;
    const projectId = await startDesign(page, name);
    await prepare(email, projectId, name);

    await page.goto(`/studio/${projectId}/make`);
    await expect(page.getByRole("heading", { level: 1, name: "Product created" })).toBeVisible();
    // No factory capability covers this article, so there is no price and no date, and the page says so.
    await expect(page.getByText("No price is on file for this article yet.").first()).toBeVisible();
    await expect(page.getByText(/No delivery date yet/)).toBeVisible();
    await expect(page.getByText("Handled by the Knitwright Store")).toBeVisible();
    const runCard = page.getByRole("heading", { level: 3, name: "Order a run" }).locator("..");
    await expect(runCard.getByText(/No golden sample has been signed off/)).toBeVisible();
    await expect(runCard.getByText("Select sizes")).toHaveAttribute("aria-disabled", "true");

    // A sample: one piece of each size chosen, with its own fabric so no other test's batch is touched.
    const fabric = `make-${randomUUID().slice(0, 8)}`;
    await page.getByRole("link", { name: "Order a sample" }).click();
    await expect(page).toHaveURL(new RegExp(`/studio/${projectId}/make/sample$`));
    await page.getByLabel("Fabric", { exact: true }).fill(fabric);
    await page.getByRole("button", { name: "Send the sample request" }).click();
    await expect(page.getByText(/Sent to production/)).toBeVisible();

    // The golden sample: a photo, what the tape read, the founder's marks, and the sign-off.
    await page.goto(`/studio/${projectId}/make/golden-sample`);
    await expect(page.getByRole("heading", { level: 1, name: "Golden sample" })).toBeVisible();
    await page.getByRole("button", { name: "Start judging it" }).click();
    await expect(page.getByRole("heading", { name: "A photo of the sample" })).toBeVisible();
    await page.getByRole("button", { name: "Attach it" }).click();
    await expect(page.getByText(/1 photo on file/)).toBeVisible();
    await page.getByLabel("Point", { exact: true }).fill("A");
    await page.getByLabel("Code", { exact: true }).fill("chest_1cm_below_armhole");
    await page.getByLabel("Measured, mm", { exact: true }).fill("532");
    await page.getByLabel("Should be, mm", { exact: true }).fill("530");
    await page.getByLabel("Tolerance minus", { exact: true }).fill("10");
    await page.getByLabel("Tolerance plus", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Record the measurement" }).click();
    await expect(page.getByText(/is 2 mm off, inside minus 10 to plus 10 mm/)).toBeVisible();
    await page.getByRole("button", { name: "Sign this sample off" }).click();
    await expect(page.getByText(/Signed off by the founder/)).toBeVisible();

    // With the sign-off on file the run gate is open, and the order is handed to production.
    await page.goto(`/studio/${projectId}/make`);
    await expect(runCard.getByText(/A golden sample of this version has been signed off/)).toBeVisible();
    await page.getByRole("link", { name: "Select sizes" }).click();
    await expect(page).toHaveURL(new RegExp(`/studio/${projectId}/make/order$`));
    await page.getByRole("heading", { level: 3, name: new RegExp(name) }).waitFor();
    await page.getByLabel("Size M", { exact: true }).fill("60");
    await expect(page.getByText(/60 pieces/)).toBeVisible();
    await page.getByRole("button", { name: "Hand this order to production" }).click();
    await expect(page.getByText(/Sent to production: 1 order/)).toBeVisible();
  });

  test("a Class B run outside 50 to 300 pieces is refused before anything is sent", async ({ page }) => {
    const email = await createAccount("make-class", { brand: "Oak Make" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    const name = `Class tee ${randomUUID().slice(0, 8)}`;
    const projectId = await startDesign(page, name);
    await prepare(email, projectId, name);

    await page.goto(`/studio/${projectId}/make/order`);
    await page.getByRole("heading", { level: 3, name: new RegExp(name) }).waitFor();
    await page.getByLabel("Size M", { exact: true }).fill("20");
    await expect(page.getByText(/A Class B run is 50 to 300 pieces per style/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Hand this order to production" })).toBeDisabled();
  });
});

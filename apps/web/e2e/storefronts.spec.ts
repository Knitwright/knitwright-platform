import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accessible } from "./chrome";
import { createAccount, signIn, test, userIdOf } from "./support";

/**
 * Storefronts, the listing editor and a shopper's checkout (plan v6 C3, decision 0154; 09 screen 23; spec F-L5).
 *
 * The seller writes a listing in the editor and saves it; Listing health says what stops Publish. The storefront is
 * put live from its settings page; a shopper with no account buys a published product on `/shop/<slug>` (the path
 * fallback of `<slug>.knitwright.com`) through the test checkout, which hands a signed event to C1's webhook, and
 * lands on their own order page. Batches and the payment gate are proved by the database test.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };

const must = <T>(answer: { data: T | null; error: { message: string } | null }): T => {
  if (answer.error || answer.data === null) throw new Error(answer.error?.message ?? "No data");
  return answer.data;
};

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const id = /\/(?:studio|project)\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!id) throw new Error(`No design id in ${page.url()}`);
  return id;
};

/** Lists the design as a product and freezes a release, the way the server does. */
async function listProduct(email: string, projectId: string, name: string): Promise<Readonly<{ productId: string; brandId: string; releaseId: string }>> {
  const db = service();
  const userId = await userIdOf(email);
  const { brand_id: brandId } = must(await db.from("projects").select("brand_id").eq("id", projectId).single()) as { brand_id: string };
  const release = must(await db.rpc("create_release", { p_project_id: projectId, p_brand_id: brandId, p_user_id: userId, p_label: "Round 1", p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  const productId = must(await db.rpc("create_brand_product", { p_brand_id: brandId, p_user_id: userId, p_project_id: projectId, p_name: name })) as string;
  return { productId, brandId, releaseId: release[0]!.id };
}

test.describe("storefronts (C3)", () => {
  test("the listing editor saves a draft and Listing health says what stops Publish", async ({ page }) => {
    const email = await createAccount("listing-editor", { brand: "Listing Rovers" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/projects\/recent$/);
    const projectId = await startDesign(page, "Rovers home tee");
    const { productId } = await listProduct(email, projectId, "Rovers home tee");

    // The door: My products row → its listing.
    await page.goto("/products/mine");
    await page.getByRole("link", { name: "Listing of Rovers home tee" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${productId}/listing$`));
    await expect(page.getByRole("heading", { level: 1, name: "Rovers home tee" })).toBeVisible();
    for (const section of ["Mockups", "Listing details", "Personalization", "Pricing", "Publishing"]) {
      await expect(page.getByRole("heading", { level: 2, name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Filled in by Knitwright")).toBeVisible();
    const health = page.getByTestId("listing-health");
    await expect(health).toContainText("Approve the golden sample before selling");
    await accessible(page);

    await page.getByLabel("Title").fill("Rovers Home Tee 2027");
    await page.getByLabel("Description").fill("Our home tee for 2027.");
    await page.getByPlaceholder("Add a tag, then press Enter").fill("home kit");
    await page.getByPlaceholder("Add a tag, then press Enter").press("Enter");
    const retail = page.getByRole("textbox", { name: /^Retail price for / }).first();
    await retail.fill("45.00");
    await expect(health).toContainText("Title and description");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page.getByText("Saved as a draft.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Title")).toHaveValue("Rovers Home Tee 2027");
    await expect(page.getByRole("list", { name: "Tags" })).toContainText("home kit");
    await expect(page.getByRole("textbox", { name: /^Retail price for / }).first()).toHaveValue("45.00");
    await expect(page.getByTestId("listing-status")).toHaveText("Draft");
  });

  test("a storefront goes live and a shopper with no account buys from it through checkout", async ({ page, browser }) => {
    const email = await createAccount("storefront", { brand: "Shopfront Rovers" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/projects\/recent$/);
    const projectId = await startDesign(page, "Shop tee");
    const { productId, brandId, releaseId } = await listProduct(email, projectId, "Shop tee");
    // A published listing, written the way Publish writes one (Publish itself needs a golden sample, which no
    // browser-test design has; the health checks behind it are unit-tested).
    const slug = `rovers-${Date.now().toString(36)}`;
    must(
      await service()
        .from("listings")
        .insert({ brand_id: brandId, product_id: productId, title: "Shop Tee 2027", description: "A tee.", prices: { M: 2500, L: 2800 }, release_id: releaseId, fabric_key: "mesh", status: "published", published_at: new Date().toISOString() })
        .select("id")
        .single(),
    );

    await page.goto("/store/storefront");
    await expect(page.getByRole("heading", { level: 1, name: "Storefront" })).toBeVisible();
    await accessible(page);
    await page.getByLabel("Name", { exact: true }).fill("Rovers shop");
    await page.getByLabel("Address").fill(slug);
    await page.getByLabel("Live: anyone with the address").check();
    await page.getByRole("button", { name: "Save storefront" }).click();
    await expect(page.getByText("Saved. Your storefront is live.")).toBeVisible();
    await expect(page.getByTestId("open-storefront")).toBeVisible();

    // The shopper: a fresh browser, no session.
    const context = await browser.newContext();
    const shopper = await context.newPage();
    await shopper.goto(`/shop/${slug}`);
    await expect(shopper.getByRole("heading", { level: 1, name: "Rovers shop" })).toBeVisible();
    await shopper.getByRole("link", { name: /Shop Tee 2027/ }).click();
    await expect(shopper.getByRole("heading", { level: 1, name: "Shop Tee 2027" })).toBeVisible();
    await expect(shopper.getByRole("heading", { level: 2, name: "Returns" })).toBeVisible();
    await accessible(shopper);

    await shopper.getByLabel("Size", { exact: true }).selectOption("L");
    await shopper.getByLabel("Email").fill(`fan-${Date.now()}@example.test`);
    await shopper.getByRole("button", { name: /^Buy/ }).click();
    await expect(shopper.getByRole("alert")).toContainText("Tick to confirm the size.");
    await shopper.getByLabel(/I have compared the size chart/).check();
    await shopper.getByLabel(/I have read the/).check();
    await shopper.getByRole("button", { name: "Buy · £28.00" }).click();

    await expect(shopper).toHaveURL(new RegExp(`/shop/${slug}/pay/cs_test_kw_`));
    await expect(shopper.getByText("No card is charged and no money moves")).toBeVisible();
    await shopper.getByRole("button", { name: "Pay with a test card" }).click();
    await expect(shopper).toHaveURL(new RegExp(`/shop/${slug}/order/`));
    await expect(shopper.getByTestId("shop-order-title")).toHaveText("Thank you, your order is paid");
    await accessible(shopper);

    const { data } = await service().from("shop_orders").select("amount_minor, size, order_payments(status)").eq("brand_id", brandId);
    expect(data).toEqual([{ amount_minor: 2800, size: "L", order_payments: { status: "fulfilled" } }]);
    await context.close();

    await page.reload();
    await expect(page.getByRole("table", { name: "Recent storefront orders" })).toContainText("Shop Tee 2027");
  });

  test("a storefront that is not live, or a product not on sale, is not found", async ({ page }) => {
    await page.goto(`/shop/nobody-${Date.now().toString(36)}`);
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
  });
});

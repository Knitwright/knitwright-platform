import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accessible } from "./chrome";
import { createAccount, signIn, test, userIdOf } from "./support";

/**
 * Sales channels (09 screen 24; plan v6 C4, decision 0155), against the Shopify stand-in: playwright.config.ts turns
 * SHOPIFY_APP_TEST_MODE on, so "Connect" walks the real OAuth return (Shopify's HMAC, our signed state cookie, the
 * sealed token) through a page of the app that stands where Shopify's install page would. No Shopify key is set.
 *
 * Pushing a product and taking an order in both need a product at the run stage (an approved golden sample); the
 * unit tests walk that with C1's door stood in and the database tests prove C1's gate passes on the invoice line.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

/** A design listed as a product, as the server lists one, still at the idea stage. Returns its id. */
async function ideaProduct(email: string): Promise<string> {
  const db = service();
  const userId = await userIdOf(email);
  const brand = await db.from("memberships").select("brand_id").eq("user_id", userId).single();
  if (brand.error) throw new Error(brand.error.message);
  const brandId = brand.data.brand_id as string;
  const project = await db.rpc("create_project", { p_brand_id: brandId, p_user_id: userId, p_name: "Channel tee", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 });
  if (project.error) throw new Error(project.error.message);
  const product = await db.rpc("create_brand_product", { p_brand_id: brandId, p_user_id: userId, p_project_id: project.data, p_name: "Channel tee" });
  if (product.error) throw new Error(product.error.message);
  return product.data as string;
}

test.describe("sales channels", () => {
  test("a Shopify shop is connected through the install page, managed and disconnected", async ({ page }) => {
    await signIn(page, await createAccount("channels", { brand: "Channel Rovers" }));
    await expect(page).toHaveURL(/\/projects\/recent$/);
    await page.goto("/store/channels");
    await expect(page.getByRole("heading", { level: 1, name: "Sales channels" })).toBeVisible();
    for (const name of ["Shopify", "Etsy", "TikTok Shop", "Knitwright team store", "WooCommerce", "API or CSV"]) {
      // The card's own title: the API or CSV panel below the cards has a heading of the same name.
      await expect(page.locator(`section[id^="channel-"]`).getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
    // A channel that is not built says so: its button is disabled, never a link to nowhere.
    await expect(page.locator("#channel-etsy").getByRole("button", { name: "Later" })).toHaveAttribute("aria-disabled", "true");
    await accessible(page);

    // The header's button opens the radio cards; Continue on Shopify asks for the shop.
    await page.getByRole("button", { name: "Connect a sales channel" }).click();
    const modal = page.getByRole("dialog", { name: "Connect to a sales channel" });
    await expect(modal.getByRole("radio", { name: /Shopify/ })).toBeChecked();
    await accessible(page);
    await modal.getByRole("button", { name: "Continue", exact: true }).click();
    const shop = `rovers-${randomUUID().slice(0, 8)}`;
    await modal.getByLabel("Your shop's address").fill(shop);
    await modal.getByRole("button", { name: "Continue to Shopify" }).click();

    await expect(page).toHaveURL(/\/store\/channels\/test-install\?/);
    await expect(page.getByRole("heading", { level: 1, name: `Install Knitwright on ${shop}.myshopify.com?` })).toBeVisible();
    await page.getByRole("link", { name: "Install app" }).click();

    await expect(page).toHaveURL(/\/store\/channels\?shopify=connected$/);
    await expect(page.getByText("Your Shopify shop is connected.")).toBeVisible();
    const manage = page.locator("#shopify-manage");
    await expect(manage.getByRole("heading", { level: 2, name: `Shopify · ${shop}.myshopify.com` })).toBeVisible();
    await expect(page.locator("#channel-shopify").getByRole("link", { name: "Connected · Manage" })).toBeVisible();
    await expect(manage.getByText("No products yet.")).toBeVisible();
    await accessible(page);

    // The stand-in's test order needs a listing first, and says so.
    await manage.getByRole("button", { name: "Send a test order" }).click();
    await expect(manage.getByText("Push a product to the shop first.")).toBeVisible();

    await manage.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.locator("#channel-shopify").getByRole("button", { name: "Connect Shopify" })).toBeVisible();
  });

  test("a CSV of orders is refused whole when a product is not ready to sell, and the exports download", async ({ page }) => {
    const email = await createAccount("channels-csv", { brand: "Channel Sheets" });
    const productId = await ideaProduct(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/projects\/recent$/);
    await page.goto("/store/channels#api-csv");

    const panel = page.locator("#api-csv");
    const download = page.waitForEvent("download");
    await panel.getByRole("link", { name: "Products and SKUs (CSV)" }).click();
    expect((await download).suggestedFilename()).toBe("knitwright-products.csv");

    const sku = `KW-${productId.replaceAll("-", "")}-M`;
    await panel.getByLabel("Orders file").setInputFiles({ name: "orders.csv", mimeType: "text/csv", buffer: Buffer.from(`order_ref,sku,quantity\nclub-1,${sku},2\n`) });
    await panel.getByRole("button", { name: "Import orders" }).click();
    await expect(panel.getByText(/Not ready to sell: approve its golden sample first/)).toBeVisible();
    await expect(panel.getByText("No orders yet.")).toBeVisible();

    await panel.getByLabel("Orders file").setInputFiles({ name: "orders.csv", mimeType: "text/csv", buffer: Buffer.from("order_ref,sku,quantity\nclub-1,SHOP-OWN,2\n") });
    await panel.getByRole("button", { name: "Import orders" }).click();
    await expect(panel.getByText(/Row 2: the SKU is not one of your Knitwright products/)).toBeVisible();
    await accessible(page);
  });

  test("Shopify's webhook refuses an unsigned body, and the tracking job needs the scheduler's secret", async ({ request }) => {
    const hook = await request.post("/api/channels/shopify/webhooks", { data: { id: 1 }, headers: { "x-shopify-topic": "orders/paid", "x-shopify-shop-domain": "a.myshopify.com", "x-shopify-hmac-sha256": "AAAA" } });
    expect(hook.status()).toBe(401);
    const notice = await request.post("/api/channels/shopify/fulfilment/fulfillment_order_notification", { data: {}, headers: { "x-shopify-shop-domain": "a.myshopify.com" } });
    expect(notice.status()).toBe(401);
    const cron = await request.get("/api/cron/channels-tracking", { headers: { authorization: "Bearer wrong" } });
    expect([404, 503]).toContain(cron.status());
  });
});

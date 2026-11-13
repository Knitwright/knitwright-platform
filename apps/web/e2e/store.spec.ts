import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accessible } from "./chrome";
import { createAccount, makePlatformAdmin, signIn, test, userIdOf } from "./support";

/**
 * The seller's Store (plan v6 C5, decision 0156; 09 screens 16, 24, 25): the five tabs, the margin calculator,
 * GPSR and EPR settings, parcel branding, and payouts through Stripe Connect's test onboarding (a page of the app
 * standing where Stripe's would, handing a signed `account.updated` to the one webhook). The weekly run is pressed
 * by hand on /ops/finance, and the payout it makes shows on the seller's Payouts tab.
 *
 * Each test signs up its own brand; sale references carry a random part, so a retry never finds its own leftovers.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const brandIdOf = async (userId: string): Promise<string> => {
  const { data, error } = await service().from("memberships").select("brand_id").eq("user_id", userId).single();
  if (error) throw new Error(error.message);
  return (data as { brand_id: string }).brand_id;
};

const owner = async (page: Page, label: string, brand: string): Promise<string> => {
  const email = await createAccount(label, { brand });
  await signIn(page, email);
  await expect(page).toHaveURL(/\/projects\/recent$/);
  return email;
};

test.describe("store", () => {
  test("the Overview shows the month, the store's cards and a working margin calculator", async ({ page }) => {
    await owner(page, "store-overview", "Store Overview FC");
    await page.goto("/store");
    await expect(page.getByRole("heading", { level: 1, name: "Store" })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Store" });
    await expect(tabs.getByRole("link")).toHaveText(["Overview", "Sales channels", "Branding", "Settings", "Payouts"]);
    await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("tile-sales")).toContainText("£0.00");
    await expect(page.getByTestId("card-payouts")).toContainText("Not set up");
    await expect(page.getByText("No sales yet.")).toBeVisible();

    const calculator = page.getByTestId("margin-calculator");
    await calculator.getByLabel(/Retail price/).fill("60");
    await expect(calculator.getByTestId("margin-profit")).toBeVisible();
    await expect(calculator.getByText("Base price (Knitwright)")).toBeVisible();
    await accessible(page);

    await tabs.getByRole("link", { name: "Sales channels" }).click();
    await expect(page).toHaveURL(/\/store\/channels$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sales channels" })).toBeVisible();
    await accessible(page);
  });

  test("payouts are set up through the test onboarding, and the weekly run pays a delivered sale", async ({ page }) => {
    const email = await owner(page, "store-payouts", "Store Payouts FC");
    await page.goto("/store/payouts");
    await expect(page.getByTestId("payout-account")).toContainText("Not set up");
    await expect(page.getByText("No payouts yet.")).toBeVisible();
    await accessible(page);

    await page.getByTestId("payout-onboarding").click();
    await expect(page).toHaveURL(/\/checkout\/test\/connect\/acct_test_kw_/);
    await expect(page.getByText("No details are sent and no money moves")).toBeVisible();
    await accessible(page);
    await page.getByTestId("test-onboarding-finish").click();

    await expect(page).toHaveURL(/\/store\/payouts\?onboarding=back$/);
    await expect(page.getByText("Payouts are set up.")).toBeVisible();
    await expect(page.getByTestId("payout-account")).toContainText("Active");

    // A storefront sale, recorded as a selling checkout records one, then delivered as ops confirms it.
    const userId = await userIdOf(email);
    const brandId = await brandIdOf(userId);
    const sale = await service().rpc("record_seller_sale", {
      p_brand_id: brandId, p_channel: "storefront", p_source_ref: `e2e-${randomUUID()}`, p_product_id: null, p_product_name: "Payout test shirt", p_quantity: 1,
      p_currency: "GBP", p_retail_minor: 4500, p_base_minor: 2500, p_shipping_minor: 120, p_duty_minor: 314, p_channel_fee_minor: 88, p_knitwright_fee_minor: 0, p_order_id: null,
    });
    expect(sale.error).toBeNull();
    await page.reload();
    await expect(page.getByRole("table", { name: "Sales" })).toContainText("Waiting for delivery");

    await makePlatformAdmin(email);
    await page.goto("/ops/finance");
    await expect(page.getByRole("heading", { level: 2, name: "Seller payouts" })).toBeVisible();
    await expect(page.getByTestId("liability-GBP")).toContainText("Held until delivery");
    const waiting = page.getByRole("list", { name: "Sales waiting for delivery" }).getByRole("listitem").filter({ hasText: "Payout test shirt" });
    await waiting.getByRole("button", { name: "Mark delivered" }).click();
    await expect(page.getByText("Marked delivered.")).toBeVisible();
    await page.getByTestId("run-seller-payouts").click();
    await expect(page.getByText(/payouts sent to Stripe/)).toBeVisible();

    await page.goto("/store/payouts");
    await expect(page.getByRole("table", { name: "Payouts" })).toContainText("£14.78");
    await expect(page.getByRole("table", { name: "Payouts" })).toContainText("On its way to your bank");
    await expect(page.getByRole("table", { name: "Sales" })).toContainText("Paid out");
    await accessible(page);
  });

  test("GPSR and EPR details are saved, and a malformed LUCID number is refused", async ({ page }) => {
    await owner(page, "store-settings", "Store Settings FC");
    await page.goto("/store/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Store settings" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Product safety" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Until an EU responsible person is saved")).toBeVisible();
    await accessible(page);

    const gpsr = page.getByTestId("gpsr-form");
    await gpsr.getByLabel("Name").fill("EU Rep GmbH");
    await gpsr.getByLabel("Address").fill("Friedrichstrasse 1, Berlin");
    await gpsr.getByLabel("Email").fill("rep@example.com");
    await gpsr.getByRole("button", { name: "Save" }).click();
    await expect(gpsr.getByText("Saved.")).toBeVisible();
    await expect(page.getByText("Until an EU responsible person is saved")).toHaveCount(0);

    await page.getByRole("tab", { name: "Packaging (EPR)" }).click();
    const epr = page.getByTestId("epr-form");
    await epr.getByLabel("LUCID registration number").fill("12345");
    await epr.getByRole("button", { name: "Save" }).click();
    await expect(epr.getByRole("alert")).toBeVisible();
    await epr.getByLabel("LUCID registration number").fill("DE1234567890123");
    await epr.getByRole("button", { name: "Save" }).click();
    await expect(epr.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("gpsr-form").getByLabel("Name")).toHaveValue("EU Rep GmbH");
  });

  test("a branding item is set up for every parcel", async ({ page }) => {
    await owner(page, "store-branding", "Store Branding FC");
    await page.goto("/store/branding");
    await expect(page.getByRole("heading", { level: 1, name: "Branding" })).toBeVisible();
    const card = page.getByTestId("branding-neck_labels");
    await expect(card).toContainText("From £0.40 per item");
    await accessible(page);
    await card.getByRole("button", { name: "Set up Neck labels" }).click();
    const dialog = page.getByRole("dialog", { name: "Neck labels" });
    await dialog.getByRole("switch").click();
    await dialog.getByLabel("Note for Knitwright").fill("Crest and size");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toContainText("On");
    await expect(card).toContainText("Crest and size");
  });

  test("a visitor is sent to sign in", async ({ page }) => {
    await page.goto("/store/payouts");
    await expect(page).toHaveURL(/sign-in/);
  });
});

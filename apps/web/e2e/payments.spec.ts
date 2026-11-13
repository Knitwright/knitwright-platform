import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accessible } from "./chrome";
import { createAccount, makePlatformAdmin, signIn, test } from "./support";

/**
 * Payments core (plan v6 C1, decision 0152), through the test checkout: a page of the app that stands where
 * Stripe's would and hands a signed event to the same webhook Stripe's endpoint uses. The browser tests never set a
 * Stripe key (playwright.config.ts turns PAYMENTS_TEST_CHECKOUT on), so this is the whole card path with no network.
 *
 * Order checkout with a price on file is covered by the database tests (a design with a priced article needs the
 * factory's ladder, which no browser-test design has); every browser order today goes the invoice path, which the
 * make, collection and brand-run specs walk.
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const balance = (text: string): number => Number(/^(\d+)/.exec(text.trim())?.[1] ?? Number.NaN);

test.describe("payments", () => {
  test("a credit pack is bought through checkout, and its credits land once paid", async ({ page }) => {
    await signIn(page, await createAccount("pay-credits", { brand: "Pay Rovers" }));
    await expect(page).toHaveURL(/\/projects\/recent$/);
    await page.goto("/credits");
    const before = balance(await page.getByTestId("credit-balance-figure").innerText());

    const packs = page.getByTestId("buy-credits");
    await expect(packs).toContainText("500 credits");
    await expect(packs).toContainText("Placeholder pack prices");
    await packs.getByRole("button", { name: "Buy" }).first().click();

    await expect(page).toHaveURL(/\/checkout\/test\/cs_test_kw_/);
    await expect(page.getByRole("heading", { level: 1, name: "500 Knitwright credits" })).toBeVisible();
    await expect(page.getByText("No card is charged and no money moves")).toBeVisible();
    await accessible(page);
    await page.getByRole("button", { name: "Pay with a test card" }).click();

    await expect(page).toHaveURL(/\/checkout\/return\?payment=/);
    await expect(page.getByRole("heading", { level: 1, name: "Paid" })).toBeVisible();
    await expect(page.getByText("The credits are in your balance.")).toBeVisible();
    await accessible(page);

    await page.getByRole("link", { name: "Your credits" }).click();
    await expect(page).toHaveURL(/\/credits$/);
    await expect(page.getByTestId("credit-balance-figure")).toContainText(`${before + 500} credits`);
  });

  test("leaving the checkout charges nothing", async ({ page }) => {
    await signIn(page, await createAccount("pay-cancel", { brand: "Pay Leavers" }));
    await expect(page).toHaveURL(/\/projects\/recent$/);
    await page.goto("/credits");
    await page.getByTestId("buy-credits").getByRole("button", { name: "Buy" }).first().click();
    await expect(page).toHaveURL(/\/checkout\/test\//);
    await page.getByRole("button", { name: "Cancel and go back" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Checkout cancelled" })).toBeVisible();
    await expect(page.getByText("Nothing was charged.")).toBeVisible();
  });

  test("the webhook refuses a body that is not signed", async ({ request }) => {
    const answer = await request.post("/api/payments/webhook", { data: { id: "evt_forged", type: "checkout.session.completed", data: { object: {} } } });
    expect(answer.status()).toBe(400);
  });

  test("ops sees GMV and revenue apart, and a deposit over the headroom is refused", async ({ page }) => {
    const email = await createAccount("pay-ops", { brand: "Pay Ops" });
    await makePlatformAdmin(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/projects\/recent$/);
    await page.goto("/ops/finance");
    await expect(page.getByRole("heading", { level: 1, name: "Finance" })).toBeVisible();
    const gbp = page.getByTestId("finance-GBP");
    await expect(gbp.getByTestId("figure-gmv")).toContainText("GMV");
    await expect(gbp.getByTestId("figure-revenue")).toContainText("Revenue");
    await accessible(page);

    const deposit = page.getByTestId("deposit-form");
    await deposit.getByLabel("Amount").fill("99999");
    await deposit.getByLabel("What it is for").fill("More than anyone has paid");
    await deposit.getByRole("button", { name: "Record the deposit" }).click();
    await expect(deposit.getByRole("alert")).toContainText("collected cash less the refund reserve");
    const { data } = await service().from("factory_deposits").select("id").eq("note", "More than anyone has paid");
    expect(data ?? []).toEqual([]);
  });
});

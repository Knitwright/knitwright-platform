import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { createAccount, passBotCheck, signIn, standInForBotCheck, test } from "./support";
import { seedTeamStore } from "./team-store-seed";

/**
 * Team stores and club pages (spec F-T6, plan v6 C2, decision 0153).
 *
 * Acceptance: "a parent checks out in under 2 minutes on a phone". A parent with no account opens the store's link
 * on a phone, orders two shirts with names and numbers, pays through the test checkout (which signs the event and
 * hands it to C1's webhook, the real path), and lands on the store's own return page. The club then sees the pieces
 * and the names on Team › Stores, and the club page lists the store. Closing at the minimum and refunding below it
 * are the database and unit tests' (they need a golden sample and Stripe-shaped refunds).
 */

test.describe("a team store", () => {
  test("a parent buys on a phone with no account, and the club sees it", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const run = Math.random().toString(36).slice(2, 8);
    const email = await createAccount("store-manager", { brand: `Store FC ${run}` });
    const store = await seedTeamStore(email, `U16s home ${run}`);

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await standInForBotCheck(phone);
    await phone.setExtraHTTPHeaders({ "x-real-ip": `10.9.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });
    const parent = await phone.newPage();
    const started = Date.now();
    await parent.goto(`/t/${store.code}`);
    await expect(parent.getByTestId("team-store-title")).toHaveText(`U16s home ${run}`);
    await expect(parent.getByText("£31.90 a piece")).toBeVisible();
    expect((await new AxeBuilder({ page: parent }).analyze()).violations).toEqual([]);

    const pieces = parent.getByTestId("store-piece");
    await pieces.nth(0).getByLabel("Size").selectOption("M");
    await pieces.nth(0).getByLabel("Name on the back").fill("khan");
    await pieces.nth(0).getByLabel("Number").fill("10");
    await parent.getByRole("button", { name: "Add another piece" }).click();
    await pieces.nth(1).getByLabel("Size").selectOption("S");
    await parent.getByLabel("Your name").fill("Sam Parent");
    await parent.getByLabel("Your email").fill(`parent-${run}@example.test`);
    await passBotCheck(parent);
    await parent.getByRole("button", { name: "Pay £63.80" }).click();

    await expect(parent).toHaveURL(new RegExp(`/t/${store.code}/pay/cs_test_kw_`));
    await parent.getByTestId("store-test-pay").click();
    await expect(parent).toHaveURL(new RegExp(`/t/${store.code}/done\\?payment=`));
    await expect(parent.getByTestId("team-store-outcome")).toHaveText("Paid. Thank you");
    expect(Date.now() - started).toBeLessThan(120_000);
    await phone.close();

    await signIn(page, email);
    await expect(page).toHaveURL(/\/projects\/recent$/);
    await page.goto("/team?tab=stores");
    const card = page.getByTestId("team-store-card").filter({ hasText: `U16s home ${run}` });
    await expect(card).toContainText("2 of 10 pieces minimum");
    await expect(card).toContainText("Club margin 10% (£2.90 a piece)");
    await expect(card.getByTestId("team-store-link")).toHaveAttribute("href", new RegExp(`/t/${store.code}$`));
    await card.getByRole("button", { name: "QR code" }).click();
    await expect(card.getByRole("img", { name: `QR code for U16s home ${run}` })).toBeVisible();
    await page.getByText("Names and numbers (2)").click();
    await expect(page.getByRole("table", { name: `Names and numbers bought from U16s home ${run}` })).toContainText("KHAN");

    await page.goto(`/clubs/${store.slug}`);
    await expect(page.getByTestId("club-name")).toHaveText(`Store FC ${run}`);
    await expect(page.getByRole("link", { name: `U16s home ${run}` })).toHaveAttribute("href", `/t/${store.code}`);
    await expect(page.getByText("kit@e2e.example")).toBeVisible();
  });

  test("a code that opens nothing and a club page nobody published answer 404", async ({ page }) => {
    expect((await page.goto("/t/Zz9zZz9zZz"))?.status()).toBe(404);
    expect((await page.goto("/clubs/nobody-published-this"))?.status()).toBe(404);
  });
});

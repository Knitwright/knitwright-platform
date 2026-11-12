import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { seedTemplates } from "../lib/templates/seed/seed";
import { createAccount, signIn, test } from "./support";

/**
 * Plan v6 P4 (decision 0142): the Products area. The catalogue home, a category page, a product page with its
 * configurator, My products and Trending ideas, and the 308s from the pages it replaced. The catalogue and the
 * article page tests of plan v5 Y1 and O3 (decisions 0074 and 0104) moved here with their behaviour.
 *
 * Needs local Supabase (`pnpm db:start`). The catalogue is platform data seeded by the migrations, so nothing here
 * creates a row another spec could pick up, except the one design the configurator test makes in its own brand.
 */

// Trending ideas reads the template library, which `e2e/templates.spec.ts` seeds the same way.
test.beforeAll(async () => {
  await seedTemplates(createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }));
});

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label, { brand: `${label} club` }));
  await expect(page).toHaveURL(/\/studio$/);
};

const accessible = async (page: Page): Promise<void> => {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  const where = (node: (typeof serious)[number]["nodes"][number]): string => `${node.target.join(" ")} ${JSON.stringify(node.any.map((check) => check.data))}`;
  expect(serious.map((entry) => `${entry.id}: ${entry.help} (${entry.nodes.slice(0, 3).map(where).join("; ")})`)).toEqual([]);
};

const cardOf = (page: Page, list: string, code: string) => page.getByRole("list", { name: list }).locator("> li").filter({ hasText: code });

test.describe("the catalogue home", () => {
  test("shows the tabs, the rows and every price as the placeholder it is", async ({ page }) => {
    await signedIn(page, "p4-home");
    await page.goto("/products");
    await expect(page.getByRole("heading", { level: 1, name: "Catalogue" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Products" }).getByRole("link", { name: "Catalogue" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: /^Training/ })).toHaveAttribute("href", "/products/training");

    const jersey = cardOf(page, "Top picks for clubs", "JSY-SS-01");
    await expect(jersey).toContainText("From £22.00 · from 1 pc");
    await expect(jersey).toContainText("Placeholder club price from the build pack, not a factory quote");
    await expect(jersey).toContainText("Priced from 10 pcs; no price is set for 1 pc yet.");
    await expect(jersey).toContainText("Studio Pro price not set yet");
    // Order swatch book stays visible and says why it does nothing yet (no fake flow before checkout).
    await expect(page.getByRole("button", { name: "Order swatch book" })).toHaveAttribute("aria-disabled", "true");
    await page.getByText("What is the minimum order?").click();
    await expect(page.getByText(/^From 1 piece, on 1 of 8 bases\./)).toBeVisible();
    await accessible(page);
  });

  test("the old addresses answer 308 to their new ones", async ({ page }) => {
    await signedIn(page, "p4-moved");
    for (const [from, to] of [
      ["/catalogue", /\/products$/],
      ["/catalogue/JSY-SS-01?market=au", /\/products\/JSY-SS-01\?market=au$/],
      ["/catalogue?tab=templates", /\/templates\?tab=templates$/],
      ["/brands/fabrics", /\/products\/fabrics$/],
    ] as const) {
      const answer = await page.request.get(from, { maxRedirects: 0 });
      expect(answer.status(), from).toBe(308);
      await page.goto(from);
      await expect(page).toHaveURL(to);
    }
  });
});

test.describe("a category page", () => {
  test("filters by the bar, keeps the market, and says when nothing matches", async ({ page }) => {
    await signedIn(page, "p4-category");
    await page.goto("/products/all");
    await expect(page.getByRole("heading", { level: 1, name: "All products" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Base products" }).locator("> li")).toHaveCount(8);

    await page.getByLabel("Production class").selectOption({ label: "Class B (2)" });
    await page.getByRole("button", { name: "Show products" }).click();
    await expect(page.getByRole("list", { name: "Base products" }).locator("> li")).toHaveCount(2);
    await expect(page.getByText("2 base products")).toBeVisible();
    await expect(page.getByRole("button", { name: "Decoration" })).toHaveAttribute("aria-disabled", "true");
    await accessible(page);

    await page.goto("/products/all?market=au");
    await expect(cardOf(page, "Base products", "JSY-SS-01")).toContainText("No AUD price is set yet");
    await expect(cardOf(page, "Base products", "JSY-SS-01")).not.toContainText("£");

    await page.goto("/products/all?q=nothing-is-called-this");
    await expect(page.getByRole("heading", { name: "No product matches these filters" })).toBeVisible();
  });

  test("answers not found for a category or a code the catalogue does not hold", async ({ page }) => {
    await signedIn(page, "p4-missing");
    expect((await page.goto("/products/curling"))?.status()).toBe(404);
    expect((await page.goto("/products/ZZZ-ZZ-99"))?.status()).toBe(404);
  });
});

test.describe("the product page", () => {
  test("shows the ladder, the Fulfilment box, the size guide in cm and in, each with a Why?", async ({ page }) => {
    await signedIn(page, "p4-product");
    await page.goto("/products/JSY-SS-01");
    await expect(page.getByRole("heading", { level: 1, name: /Short-sleeve sublimated jersey/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pictures" })).toContainText("Render, not photo");

    const prices = page.getByRole("region", { name: "Price ladder" });
    await expect(prices.getByRole("row")).toHaveCount(4);
    await expect(prices).toContainText("£29.00");
    await expect(prices).toContainText("£22.00");

    // No date anywhere while QC and freight days are unset (decision 0104).
    await expect(page.getByRole("region", { name: "Fulfilment" })).toContainText("No delivery date yet. Not set:");
    await expect(page.getByRole("region", { name: "Options available" })).toContainText("V-neck");

    const guide = page.getByRole("region", { name: "Size guide" });
    await expect(guide.getByRole("row")).toHaveCount(13);
    await expect(guide).toContainText("Finished garment measurements, in cm.");
    await guide.getByRole("radio", { name: "in" }).click();
    await expect(guide).toContainText("Finished garment measurements, in in.");

    await page.getByRole("tab", { name: "Embroidery" }).click();
    await expect(page.getByText("Embroidery is not agreed with the factory for this base yet.")).toBeVisible();
    await accessible(page);

    await prices.getByRole("button", { name: "Why? Rulebook R-COST-003" }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
  });

  test("says what choosing Australia means: the currency, the GST, the label lines and what is missing", async ({ page }) => {
    await signedIn(page, "p4-market");
    await page.goto("/products/JSY-SS-01?market=au");
    const market = page.getByRole("region", { name: "Selling in Australia" });
    await expect(market).toContainText("Prices are shown in AUD.");
    await expect(market).toContainText("Prices carry no GST: Knitwright is not registered for GST in Australia.");
    await expect(market).toContainText("No delivery date yet. Not set: the days for QC and the freight days.");
    await expect(market.getByRole("list", { name: "Label lines for Australia" }).getByRole("listitem")).toHaveCount(5);
    const prices = page.getByRole("region", { name: "Price ladder" });
    await expect(prices).toContainText("No AUD price is set yet");
    await expect(prices).not.toContainText("£");
  });

  test("Design this opens the configurator, keeps unsampled options locked, and opens the editor on this base", async ({ page }) => {
    await signedIn(page, "p4-design");
    await page.goto("/products/JSY-SS-01");
    await page.getByRole("button", { name: "Design this" }).click();
    const configurator = page.getByRole("dialog", { name: /Short-sleeve sublimated jersey/ });
    await expect(configurator.getByRole("button", { name: "Collar: Crew neck" })).toHaveAttribute("aria-pressed", "true");
    await expect(configurator.getByRole("button", { name: /^V-neck, locked: Not yet sampled/ })).toHaveAttribute("aria-disabled", "true");
    await accessible(page);
    await configurator.getByRole("button", { name: /^Create my design/ }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: /Short-sleeve sublimated jersey/ })).toBeVisible();
  });
});

test.describe("My products and Trending ideas", () => {
  test("My products starts empty with one way forward; Trending ideas lists the library by sport", async ({ page }) => {
    await signedIn(page, "p4-lists");
    await page.goto("/products/mine");
    await expect(page.getByRole("heading", { level: 1, name: "My products" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No products yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse the catalogue" })).toHaveAttribute("href", "/products");
    await accessible(page);

    await page.goto("/products/trends");
    await expect(page.getByRole("heading", { level: 1, name: "Trending ideas" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sports" }).getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("button", { name: /^Start a design from / }).first()).toBeVisible();
    await accessible(page);
  });
});

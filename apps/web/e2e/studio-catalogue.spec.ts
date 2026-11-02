import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * Workstream Y1 acceptance (plan v5, decision 0074): the studio home of spec F-S4 — its sidebar,
 * its action cards and its create-new modal with no blank canvas — and the catalogue and article
 * page of F-S4 and F-S8, with every price shown as the placeholder it is.
 *
 * Needs local Supabase (`pnpm db:start`). The catalogue is platform data seeded by the migrations,
 * so nothing here creates a row another spec could pick up.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label, { brand: `${label} club` }));
  // signIn only presses the button: the session cookie arrives with the redirect.
  await expect(page).toHaveURL(/\/studio$/);
};

const accessible = async (page: Page): Promise<void> => {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  // The node and the figures it failed on, so a fault names the element and its colours rather than
  // only its rule (e2e/mobile.spec.ts reports the node; the colours are in the check's own data).
  const where = (node: (typeof serious)[number]["nodes"][number]): string =>
    `${node.target.join(" ")} ${JSON.stringify(node.any.map((check) => check.data))}`;
  expect(serious.map((entry) => `${entry.id}: ${entry.help} (${entry.nodes.slice(0, 3).map(where).join("; ")})`)).toEqual([]);
};

test.describe("the studio home", () => {
  test("greets the workspace, offers the action cards, and never shows a dead link", async ({ page }) => {
    await signedIn(page, "y1-home");
    await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), y1-home club$/ })).toBeVisible();

    const sidebar = page.getByRole("navigation", { name: "Studio sections" });
    await expect(sidebar.getByRole("link", { name: /^Products/ })).toHaveAttribute("href", "/studio");
    await expect(sidebar.getByRole("link", { name: "Base products" })).toHaveAttribute("href", "/catalogue");
    // Collections opens the collection plan of F-S10 (plan v5 Z4, decision 0085).
    await expect(sidebar.getByRole("link", { name: "Collections" })).toHaveAttribute("href", "/studio/collections");
    // A Projects section that is not built still says so, and is not a link.
    await expect(sidebar.getByText("Moodboards", { exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Moodboards" })).toHaveCount(0);
    await expect(sidebar.getByText("Coming in a later release").first()).toBeVisible();

    const cards = page.getByRole("region", { name: "Start here" });
    await expect(cards.getByRole("heading", { level: 3 })).toHaveText([
      "Start a new design",
      "Browse bases and templates",
      "Moodboard",
      "Collection plan",
      "Pattern fill",
      "Launch pack",
    ]);
    await expect(cards.getByRole("link", { name: "Browse bases and templates" })).toHaveAttribute("href", "/catalogue");
    await accessible(page);
  });

  test("opens the create-new modal, which offers no blank canvas, holds Tab and gives focus back", async ({ page }) => {
    await signedIn(page, "y1-modal");
    const opener = page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: "+ New" });
    await opener.click();

    const dialog = page.getByRole("dialog", { name: "Create a new design" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(["Knitwright library", "Your own"]);
    await expect(dialog.getByRole("link", { name: /^Base products/ })).toHaveAttribute("href", "/catalogue");
    await expect(dialog.getByRole("link", { name: /^Templates/ })).toHaveAttribute("href", "/catalogue?tab=templates");
    await expect(dialog.getByText("Your team")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Your team/ })).toHaveCount(0);
    await expect(dialog).toContainText("There is no blank canvas");

    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement)), `Tab ${press + 1} left the dialog`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("filters Jump back in, and says when a kind of project is not built yet", async ({ page }) => {
    await signedIn(page, "y1-jump");
    const row = page.getByRole("region", { name: "Jump back in" });
    await row.getByRole("link", { name: /^Moodboards/ }).click();
    await expect(page).toHaveURL(/\/studio\?jump=moodboards$/);
    await expect(page.getByText("Moodboards: coming in a later release.")).toBeVisible();
    await expect(page.getByRole("list", { name: /^Designs of / })).toHaveCount(0);
  });
});

test.describe("the catalogue", () => {
  test("lists the base products with a placeholder price, and filters them", async ({ page }) => {
    await signedIn(page, "y1-catalogue");
    await page.goto("/catalogue");
    await expect(page.getByRole("heading", { level: 1, name: "Base products and templates" })).toBeVisible();

    // Each card carries a list of tags, so the cards are the grid's own children, not every listitem.
    const grid = page.getByRole("list", { name: "Base products" });
    await expect(grid.locator("> li")).toHaveCount(8);
    const jersey = grid.locator("> li").filter({ hasText: "JSY-SS-01" });
    await expect(jersey).toContainText("From £22.00 · from 1 pc");
    await expect(jersey).toContainText("Placeholder club price from the build pack, not a factory quote");
    await expect(jersey).toContainText("Priced from 10 pcs; no price is set for 1 pc yet.");
    await expect(jersey).toContainText("Edit this product's form");
    await expect(jersey).toContainText("Render, not photo");
    await expect(jersey).toContainText("Draft, not reviewed by a factory");

    await page.getByLabel("Production class").selectOption({ label: "Class B (2)" });
    await page.getByRole("button", { name: "Show products" }).click();
    await expect(page.getByRole("list", { name: "Base products" }).locator("> li")).toHaveCount(2);
    await expect(page.getByText("2 base products")).toBeVisible();
    await accessible(page);
  });

  test("says no Australian price is set when the market changes", async ({ page }) => {
    await signedIn(page, "y1-market");
    await page.goto("/catalogue");
    await page.getByRole("navigation", { name: "Market and currency" }).getByRole("link", { name: "AU | AUD" }).click();
    await expect(page).toHaveURL(/market=au/);
    const jersey = page.getByRole("list", { name: "Base products" }).locator("> li").filter({ hasText: "JSY-SS-01" });
    await expect(jersey).toContainText("No AUD price is set yet");
    await expect(jersey).not.toContainText("£");
  });

  test("shows the templates tab with its own two filters", async ({ page }) => {
    await signedIn(page, "y1-templates");
    await page.goto("/catalogue?tab=templates");
    await expect(page.getByRole("navigation", { name: "Catalogue sections" }).getByRole("link", { name: "Templates" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const filters = page.getByRole("form", { name: "Filter the templates" });
    await expect(filters.getByLabel("Sport")).toBeVisible();
    await expect(filters.getByLabel("Style")).toBeVisible();
    await expect(page.getByText("Article type, fit, gender, production class and fabric filter base products, not templates.")).toBeVisible();
  });
});

test.describe("the article page", () => {
  test("shows the ladder, the fabrics, the size chart and the lead time, each with a Why?", async ({ page }) => {
    await signedIn(page, "y1-article");
    await page.goto("/catalogue/JSY-SS-01");
    await expect(page.getByRole("heading", { level: 1, name: /Short-sleeve sublimated jersey/ })).toBeVisible();
    await expect(page.getByText("Knitwright draft v0.1, not reviewed by a factory")).toBeVisible();

    const photos = page.getByRole("region", { name: "Pictures" });
    await expect(photos).toContainText("Render, not photo");
    await expect(photos).toContainText("No sample of this article has been photographed.");

    const prices = page.getByRole("region", { name: "Price ladder" });
    await expect(prices.getByRole("row")).toHaveCount(4);
    await expect(prices).toContainText("£29.00");
    await expect(prices).toContainText("£22.00");

    const fabrics = page.getByRole("region", { name: "Fabrics" });
    await expect(fabrics).toContainText("Polyester interlock");
    await expect(fabrics).toContainText("140–160 g/m²");
    await expect(fabrics).toContainText("This fabric is not one of the fabric programme's rows yet");

    const sizes = page.getByRole("region", { name: "Size chart" });
    await expect(sizes).toContainText("The sample size is M.");
    await expect(sizes.getByRole("row")).toHaveCount(13);

    const notes = page.getByRole("region", { name: "Fit, care and lead time" });
    await expect(notes).toContainText("8 working days from the weekly cut-off, before QC and freight.");
    await expect(notes).toContainText("No care wording is on file.");
    await expect(notes).toContainText("-30 to 40 mm · Not yet sampled");

    await accessible(page);

    // Every row explains itself: the first Why? opens the rule behind that price.
    await prices.getByRole("button", { name: "Why? Rulebook R-COST-003" }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
  });

  test("answers not found for a code the catalogue does not hold", async ({ page }) => {
    await signedIn(page, "y1-missing");
    const answer = await page.goto("/catalogue/ZZZ-ZZ-99");
    expect(answer?.status()).toBe(404);
  });
});

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { FLOW_TEMPLATES } from "../lib/flows/templates";
import { seedLibrary } from "../lib/templates/seed/library";
import { createAccount, signIn, test } from "./support";

/**
 * The Marketing page (09 screen 9, v6 P2, decision 0140): Create an ad opens a launch canvas with a
 * marketing board (whose panel holds the campaign form), Plan a launch pack opens the packs, the
 * gallery filters by kind, and a concept opens on a canvas. Needs the marketing layouts seeded.
 */

const serviceClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

test.beforeAll(async () => {
  await seedLibrary(serviceClient());
});

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

test.describe("the marketing page", () => {
  test("shows the headline, the featured concepts and the gallery, and is accessible", async ({ page }) => {
    await signedIn(page, "marketing-page");
    await page.goto("/marketing");
    await expect(page.getByRole("heading", { level: 1, name: "Never run out of ideas for kit launches" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Featured concepts" }).getByRole("listitem").first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Ad gallery" }).getByRole("listitem").first()).toBeVisible();
    await expect(page.locator("header").getByRole("navigation", { name: "Marketing" }).getByRole("link", { name: "Ads" })).toHaveAttribute("aria-current", "page");
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical").map((entry) => entry.id)).toEqual([]);
  });

  test("filters the gallery to videos, then back to every concept", async ({ page }) => {
    await signedIn(page, "marketing-filter");
    await page.goto("/marketing");
    await page.getByRole("group", { name: "Filter the ad gallery" }).getByRole("link", { name: "Video" }).click();
    await expect(page).toHaveURL(/kind=video/);
    await expect(page.getByRole("list", { name: "Ad gallery" }).getByText("Video", { exact: true }).first()).toBeVisible();
    await page.getByRole("group", { name: "Filter the ad gallery" }).getByRole("link", { name: "All" }).click();
    await expect(page).toHaveURL(/\/marketing$/);
  });

  test("Create an ad opens a launch canvas with a marketing board selected", async ({ page }) => {
    await signedIn(page, "marketing-ad");
    await page.goto("/marketing");
    await page.getByRole("button", { name: "Create an ad" }).click();
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}\?board=[0-9a-f-]{36}/);
  });

  test("Use this concept opens the layout on a launch canvas", async ({ page }) => {
    await signedIn(page, "marketing-concept");
    await page.goto("/marketing?kind=photo");
    const card = page.getByRole("list", { name: "Ad gallery" }).getByRole("listitem").first();
    await card.hover();
    await card.getByRole("button", { name: /^Use this concept: / }).click();
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}\?board=[0-9a-f-]{36}/);
  });

  test("Plan a launch pack lists the packs, and planning one opens it on a canvas", async ({ page }) => {
    await signedIn(page, "marketing-pack");
    await page.goto("/marketing");
    await page.getByRole("link", { name: "Plan a launch pack" }).click();
    await expect(page).toHaveURL(/\/marketing\/launch-packs$/);
    await expect(page.getByRole("list", { name: "Launch packs" }).getByRole("listitem")).toHaveCount(FLOW_TEMPLATES.length);
    await page.getByRole("button", { name: `Plan this pack: ${FLOW_TEMPLATES[0]!.title}` }).click();
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/);
  });
});

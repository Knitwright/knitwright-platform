import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { allSeedTemplates } from "../lib/templates/seed/all";
import { seedTemplates } from "../lib/templates/seed/seed";
import { createAccount, signIn, test } from "./support";

/**
 * Workstream V3 acceptance: the library lists the starters, filters narrow it, one click makes a copy and opens the editor
 * on version 1, and the grid has no serious accessibility problem. Needs local Supabase (`pnpm db:start`).
 */

const serviceClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

test.beforeAll(async () => {
  await seedTemplates(serviceClient());
});

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/studio$/);
};

const accessible = async (page: Page): Promise<void> => {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(serious.map((entry) => `${entry.id}: ${entry.help}`)).toEqual([]);
};

test.describe("the template library", () => {
  test("lists the starters, each marked as not reviewed by a factory, and the grid is accessible", async ({ page }) => {
    await signedIn(page, "templates-list");
    await page.goto("/templates");
    await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
    const grid = page.getByRole("list", { name: "Templates" });
    await expect(grid.getByRole("listitem")).toHaveCount(12);
    await expect(grid.getByText("Knitwright starter, not reviewed by a factory").first()).toBeVisible();
    await expect(grid.getByRole("img").first()).toBeVisible();
    await accessible(page);
  });

  test("narrows by sport and by colour family, and says when nothing matches", async ({ page }) => {
    await signedIn(page, "templates-filter");
    await page.goto("/templates");
    await page.getByLabel("Sport").selectOption("cricket");
    await page.getByRole("button", { name: "Show templates" }).click();
    await expect(page).toHaveURL(/sport=cricket/);
    await expect(page.getByRole("list", { name: "Templates" }).getByRole("listitem")).toHaveCount(allSeedTemplates().filter((seed) => seed.sport === "cricket").length);

    await page.goto("/templates?sport=running&colour=white");
    await expect(page.getByText("No template matches those filters.")).toBeVisible();
  });

  test("filters by football, uses a football starter and lands on version 1", async ({ page }) => {
    await signedIn(page, "templates-football");
    await page.goto("/templates");
    await page.getByLabel("Sport").selectOption("football");
    await page.getByLabel("Garment").selectOption("football-shirt");
    await page.getByRole("button", { name: "Show templates" }).click();
    await expect(page).toHaveURL(/sport=football/);
    const items = page.getByRole("list", { name: "Templates" }).getByRole("listitem");
    await expect(items).toHaveCount(3);
    await expect(items.first().getByText("Knitwright starter, not reviewed by a factory")).toBeVisible();
    await page.getByRole("button", { name: "Use this template: Red football shirt, white trim" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("version")).toHaveText("Version 1");
  });

  test("makes a copy as version 1 and opens it in the editor, leaving the template unchanged", async ({ page }) => {
    await signedIn(page, "templates-use");
    await page.goto("/templates");
    await page.getByRole("button", { name: "Use this template: Navy and gold hoops" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await page.goto("/studio");
    await expect(page.getByText("Navy and gold hoops").first()).toBeVisible();
    await page.goto("/templates");
    await expect(page.getByRole("list", { name: "Templates" }).getByRole("listitem")).toHaveCount(12);
  });

  test("offers templates first on the start page, and the blank canvas second", async ({ page }) => {
    await signedIn(page, "templates-start");
    await page.goto("/studio/start");
    const templates = page.getByRole("heading", { name: "Start from a template" });
    const blank = page.getByRole("heading", { name: "Or start from a blank canvas" });
    await expect(templates).toBeVisible();
    await expect(blank).toBeVisible();
    const [first, second] = await Promise.all([templates.boundingBox(), blank.boundingBox()]);
    expect(first!.y).toBeLessThan(second!.y);
    await expect(page.getByRole("button", { name: "Start from this garment" })).toBeVisible();
  });

  test("is closed to a visitor", async ({ page }) => {
    await page.goto("/templates");
    await expect(page).toHaveURL(/sign-in|login|signin/);
  });
});

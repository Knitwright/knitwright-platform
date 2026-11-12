import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { FLOW_TEMPLATES } from "../lib/flows/templates";
import { sportTabsOf } from "../lib/templates/feed/tabs";
import { seedLibrary } from "../lib/templates/seed/library";
import { everySeedTemplate } from "../lib/templates/seed/seed";
import { tagsOf } from "../lib/templates/seed/tagging";
import { createAccount, signIn, test } from "./support";

/**
 * The template library (09 screen 7; workstream V3 acceptance, rebuilt by v6 P2, decision 0140):
 * the Discover rows, a tab per sport and per kind, the search, the older filter address, and each
 * kind of card reaching its own flow. Needs local Supabase (`pnpm db:start`).
 */

const serviceClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

test.beforeAll(async () => {
  // The whole library: the starters, and the marketing layouts the Social tab lists.
  await seedLibrary(serviceClient());
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

const grid = (page: Page) => page.getByRole("list", { name: "Templates" });

test.describe("the template library", () => {
  test("opens on the Discover rows, each card with its drawing and its Use template pill, and is accessible", async ({ page }) => {
    await signedIn(page, "templates-list");
    await page.goto("/templates");
    await expect(page.getByRole("heading", { level: 1, name: "Templates for every sport, ready to edit" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Template categories" }).getByRole("link", { name: "Discover" })).toHaveAttribute("aria-current", "page");
    const forYou = page.getByRole("list", { name: "For you" });
    await expect(forYou.getByRole("listitem").first()).toBeVisible();
    await expect(forYou.getByRole("img").first()).toBeVisible();
    await expect(forYou.getByRole("button", { name: /^Use this template: / }).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Kit launch packs" })).toBeVisible();
    await expect(page.getByText("Knitwright starters are not reviewed by a factory")).toBeVisible();
    await accessible(page);
  });

  test("narrows by a sport tab, and says when nothing matches", async ({ page }) => {
    await signedIn(page, "templates-filter");
    await page.goto("/templates");
    await page.getByRole("navigation", { name: "Template categories" }).getByRole("link", { name: "Cricket" }).click();
    await expect(page).toHaveURL(/tab=cricket/);
    const cricket = everySeedTemplate().filter((seed) => sportTabsOf(tagsOf(seed).sport, seed.sport).includes("cricket")).length;
    await expect(grid(page).getByRole("listitem")).toHaveCount(cricket);

    await page.goto("/templates?sport=running&colour=white");
    await expect(page.getByText("No template matches those filters.")).toBeVisible();
  });

  test("finds a template by search", async ({ page }) => {
    await signedIn(page, "templates-search");
    await page.goto("/templates");
    await page.getByRole("searchbox", { name: "Search templates" }).fill("navy gold hoops");
    await page.getByRole("searchbox", { name: "Search templates" }).press("Enter");
    await expect(page).toHaveURL(/q=navy/);
    await expect(grid(page).getByText("Navy and gold hoops")).toBeVisible();
  });

  test("filters by football in the Filters panel, uses a football starter and lands on version 1", async ({ page }) => {
    await signedIn(page, "templates-football");
    await page.goto("/templates");
    await page.getByText("Filters", { exact: true }).click();
    await page.getByLabel("Sport", { exact: true }).selectOption("football");
    await page.getByLabel("Garment").selectOption("football-shirt");
    await page.getByRole("button", { name: "Show templates" }).click();
    await expect(page).toHaveURL(/sport=football/);
    // The three football shirts of plan v4, plus the white and maroon one of the launch starters (plan v5 L8).
    await expect(grid(page).getByRole("listitem")).toHaveCount(4);
    await page.getByRole("button", { name: "Use this template: Red football shirt, white trim" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("version")).toHaveText("Version 1");
  });

  test("makes a copy as version 1 and opens it in the editor, leaving the template unchanged", async ({ page }) => {
    await signedIn(page, "templates-use");
    await page.goto("/templates?sport=football&article=team-jersey");
    await page.getByRole("button", { name: "Use this template: Navy and gold hoops" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await page.goto("/studio");
    await expect(page.getByText("Navy and gold hoops").first()).toBeVisible();
    await page.goto("/templates?sport=football&article=team-jersey");
    await expect(grid(page).getByText("Navy and gold hoops")).toBeVisible();
  });

  test("lists the launch starters on the garments plan v5 added", async ({ page }) => {
    // Plan v5 L8: the hoodies, the compression top and the training shorts had no starter before.
    await signedIn(page, "templates-launch");
    await page.goto("/templates?sport=training&article=pullover-hoodie");
    await expect(page.getByText("Club training hoodie, navy with white trim")).toBeVisible();
    await expect(page.getByText("Coaches' hoodie, black with grey trim")).toBeVisible();

    await page.goto("/templates?article=compression-top");
    await expect(page.getByText("Rash guard, black with maroon binding")).toBeVisible();
  });

  test("opens a launch pack on a new launch canvas", async ({ page }) => {
    await signedIn(page, "templates-pack");
    await page.goto("/templates?tab=launch-packs");
    const pack = FLOW_TEMPLATES[0]!;
    await page.getByRole("button", { name: `Use template: ${pack.title}` }).click();
    await expect(page).toHaveURL(/\/launch\/[0-9a-f-]{36}/);
  });

  test("opens a social layout as a marketing board on a new launch canvas", async ({ page }) => {
    await signedIn(page, "templates-social");
    await page.goto("/templates?tab=social");
    await grid(page).getByRole("button", { name: /^Use template: / }).first().click();
    await expect(page).toHaveURL(/\/launch\/[0-9a-f-]{36}\?board=[0-9a-f-]{36}/);
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

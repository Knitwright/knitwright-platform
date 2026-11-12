import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { seedTemplates } from "../lib/templates/seed/seed";
import { createAccount, signIn, test } from "./support";

/**
 * The Mockups page (09 screen 8, v6 P2, decision 0140): one of the brand's products in every scene,
 * the categories and colourways in the address, a free scene downloaded as a PNG, several as a zip,
 * and Edit opening a launch canvas with a mockup board on that scene. The scenes are seeded by their
 * own migration; the design comes from a starter template, as a person's first one would.
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

/** A design of the brand's own, made from a starter, so the page has a product to show. */
const withDesign = async (page: Page): Promise<void> => {
  await page.goto("/templates?sport=football&article=team-jersey");
  await page.getByRole("button", { name: "Use this template: Navy and gold hoops" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
};

test.describe("the mockups page", () => {
  test("asks for a product first when the brand has none", async ({ page }) => {
    await signedIn(page, "mockups-empty");
    await page.goto("/mockups");
    await expect(page.getByRole("heading", { name: "Design a kit to see it in every scene" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create your first kit" })).toHaveAttribute("href", "/studio/start");
  });

  test("shows the product in every scene, narrows by category, and is accessible", async ({ page }) => {
    await signedIn(page, "mockups-list");
    await withDesign(page);
    await page.goto("/mockups");
    await expect(page.getByRole("heading", { level: 1, name: "Mockups for every kit" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Use a product: Navy and gold hoops/ })).toBeVisible();
    const grid = page.getByRole("list", { name: "Mockups" });
    await expect(grid.getByRole("heading", { name: "Front render" })).toBeVisible();
    await expect(grid.getByRole("img", { name: /./ }).first()).toBeVisible();

    await page.getByRole("navigation", { name: "Mockup categories" }).getByRole("link", { name: "Ghost" }).click();
    await expect(page).toHaveURL(/cat=ghost/);
    await expect(grid.getByRole("heading", { name: "Ghost mannequin" })).toBeVisible();
    await expect(grid.getByRole("heading", { name: "Front render" })).toHaveCount(0);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical").map((entry) => entry.id)).toEqual([]);
  });

  test("downloads one free mockup as a picture and several as a zip", async ({ page }) => {
    await signedIn(page, "mockups-download");
    await withDesign(page);
    await page.goto("/mockups?cat=renders");
    const grid = page.getByRole("list", { name: "Mockups" });
    const one = await grid.getByRole("link", { name: "Download Front render" }).getAttribute("href");
    const picture = await page.request.get(one!);
    expect(picture.status()).toBe(200);
    expect(picture.headers()["content-type"]).toBe("image/png");

    await grid.getByLabel("Select Front render for download").check();
    await grid.getByLabel("Select Back render for download").check();
    const both = await page.getByRole("link", { name: "Download selected (2)" }).getAttribute("href");
    const zip = await page.request.get(both!);
    expect(zip.status()).toBe(200);
    expect(zip.headers()["content-type"]).toBe("application/zip");
  });

  test("opens a scene on a launch canvas as a mockup board", async ({ page }) => {
    await signedIn(page, "mockups-edit");
    await withDesign(page);
    await page.goto("/mockups?cat=hanger");
    const card = page.getByRole("list", { name: "Mockups" }).getByRole("listitem").first();
    await card.hover();
    await card.getByRole("button", { name: /^Edit / }).click();
    await expect(page).toHaveURL(/\/launch\/[0-9a-f-]{36}\?panel=mockups&board=[0-9a-f-]{36}/);
  });
});

import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * W2-G: the per-panel layers prototype (decision 0053). The route is a page that does not exist unless the server runs with
 * NEXT_PUBLIC_PANEL_LAYERS=on. Both halves are written; each runs only when its flag state is the one the server was started with
 * (run `NEXT_PUBLIC_PANEL_LAYERS=on pnpm e2e panel-layers` for the second).
 */

const FLAG_ON = process.env.NEXT_PUBLIC_PANEL_LAYERS === "on";

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname;
};

test.describe("panel layers prototype, flag off (the default)", () => {
  test.skip(FLAG_ON, "The flag is on for this server.");

  test("is a page that does not exist, and the design editor does not link to it", async ({ page }) => {
    await signIn(page, await createAccount("layers-off"));
    await expect(page).toHaveURL(/\/studio$/);
    const design = await startDesign(page, "Layers off");
    await expect(page.locator('a[href$="/layers"]')).toHaveCount(0);
    const response = await page.goto(`${design}/layers`);
    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("panel-layers")).toHaveCount(0);
  });
});

test.describe("panel layers prototype, flag on", () => {
  test.skip(!FLAG_ON, "Start the server with NEXT_PUBLIC_PANEL_LAYERS=on to run this.");

  test("opens a canvas with the design's layers, adds text, saves a version and finds it again", async ({ page }) => {
    await signIn(page, await createAccount("layers-on"));
    await expect(page).toHaveURL(/\/studio$/);
    const design = await startDesign(page, "Layers on");

    await page.goto(`${design}/layers`);
    await expect(page.getByRole("heading", { level: 1, name: "Panel layers (prototype)" })).toBeVisible();
    await expect(page.getByTestId("panel-canvas").locator("canvas.upper-canvas")).toBeVisible();
    const layers = page.getByTestId("layer-list");
    await expect(layers.getByRole("button", { name: "Base colour" })).toBeVisible();
    await expect(page.getByTestId("checks-list")).toBeVisible();
    await expect(page.getByTestId("save-status")).toHaveText("Version 1 is open.");

    await page.getByRole("button", { name: "Add text" }).click();
    await expect(layers.getByRole("button", { name: 'Text "Your text"' })).toBeVisible();
    await expect(page.getByTestId("save-status")).toHaveText("Changes are not saved.");

    await page.getByRole("button", { name: "Save as a new version" }).click();
    await expect(page.getByTestId("save-status")).toHaveText("Saved as version 2.");

    await page.reload();
    await expect(page.getByTestId("layer-list").getByRole("button", { name: 'Text "Your text"' })).toBeVisible();
    await expect(page.getByTestId("save-status")).toHaveText("Version 2 is open.");
  });
});

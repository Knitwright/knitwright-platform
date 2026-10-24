import { expect, type Page } from "@playwright/test";
import { createAccount, openTool, signIn, test } from "./support";

/** Plan W2-A: the Ideas panel shows 8 to 12 alternatives and one press saves one as a new version. */

const startJersey = async (page: Page): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill("Variants test");
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Variants test" })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop() ?? "";
};

test.describe("inspiration variants (W2-A)", () => {
  test("shows 8 to 12 tiles and applies one as version 2", async ({ page }) => {
    await signIn(page, await createAccount("variants"));
    await expect(page).toHaveURL(/\/studio$/);
    await startJersey(page);
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await openTool(page, "Ideas");
    const tiles = page.getByTestId("variant-tile");
    await expect(tiles.first()).toBeVisible();
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(12);

    await tiles.first().getByRole("button").click();
    await expect(page.getByTestId("variants-note")).toContainText("Saved as version 2.");
    await expect(page.getByTestId("version")).toHaveText("Version 2");
  });

  test("pressing the same alternative twice on one version makes one new version", async ({ page }) => {
    await signIn(page, await createAccount("variants-twice"));
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startJersey(page);
    const url = `/api/projects/${projectId}/variants`;

    const listed = await (await page.request.get(url)).json();
    expect(listed.success).toBe(true);
    const variantId: string = listed.data.tiles[0].id;

    const first = await (await page.request.post(url, { data: { variantId, expectedVersion: 1 } })).json();
    expect(first).toMatchObject({ success: true, data: { version: 2, created: true } });
    const second = await (await page.request.post(url, { data: { variantId, expectedVersion: 1 } })).json();
    expect(second).toMatchObject({ success: true, data: { version: 2, created: false } });
  });
});

import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * The one canvas (plan v6 E1, decision 0145): every project opens at `/project/<id>`.
 *
 *   * a new design lands in the editor, in place on its own canvas (`?focus=garment`), and "Back to
 *     canvas" shows its Garment board with the design's flat;
 *   * the old addresses answer 308 into the canvas, with their query carried;
 *   * the plane zooms with the keys and the dock, and a board is reached with Tab;
 *   * a launch canvas opens at its own id with its boards.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}\?focus=garment$/);
  return /\/project\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
};

test.describe("a design on the one canvas", () => {
  test("opens in the editor in place, and goes back to its canvas and its garment board", async ({ page }) => {
    await signedIn(page, "canvas-design");
    const name = `Canvas kit ${randomUUID().slice(0, 6)}`;
    const id = await startDesign(page, name);

    await expect(page.getByTestId("canvas-focus")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    await page.getByTestId("canvas-focus-back").click();
    await expect(page).toHaveURL(new RegExp(`/project/${id}$`));
    await expect(page.getByTestId("flow-canvas")).toBeVisible();
    const garment = page.getByRole("article", { name: "Garment board" });
    await expect(garment).toBeVisible();
    await expect(page.getByTestId(`garment-preview-${id}`)).toBeVisible();

    await garment.getByRole("link", { name: /^Open in editor/ }).click();
    await expect(page).toHaveURL(/\?focus=[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });

  test("answers the old editor address with a permanent redirect that keeps its query", async ({ page }) => {
    await signedIn(page, "canvas-redirect");
    const id = await startDesign(page, `Moved kit ${randomUUID().slice(0, 6)}`);

    const response = await page.request.get(`/studio/${id}?view=pattern`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toMatch(new RegExp(`/project/${id}\\?(?=.*focus=garment)(?=.*view=pattern)`));

    await page.goto(`/studio/${id}/tech-pack`);
    await expect(page).toHaveURL(new RegExp(`/studio/${id}/tech-pack$`));
  });

  test("zooms with the keys and the dock, and reaches the board with Tab", async ({ page }) => {
    await signedIn(page, "canvas-zoom");
    const id = await startDesign(page, `Zoom kit ${randomUUID().slice(0, 6)}`);
    await page.goto(`/project/${id}`);

    const percent = page.getByTestId("zoom-percent");
    await expect(percent).toHaveText("100%");
    await page.getByTestId("flow-canvas").focus();
    await page.keyboard.press("-");
    await expect(percent).toHaveText("75%");
    await page.keyboard.press("1");
    await expect(percent).toHaveText("100%");
    await page.getByTestId("zoom-in").click();
    await expect(percent).toHaveText("150%");

    const board = page.locator("[data-board-id]").first();
    await board.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/board=[0-9a-f-]{36}/);
  });

  test("keeps the canvas free of serious accessibility problems", async ({ page }) => {
    await signedIn(page, "canvas-axe");
    const id = await startDesign(page, `Axe kit ${randomUUID().slice(0, 6)}`);
    await page.goto(`/project/${id}`);
    await expect(page.getByRole("article", { name: "Garment board" })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('[data-testid="launch-shell"]').analyze();
    const serious = results.violations.filter((one) => one.impact === "serious" || one.impact === "critical");
    expect(serious.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

test.describe("a launch project on the one canvas", () => {
  test("opens at its own id, and its old address redirects there", async ({ page }) => {
    await signedIn(page, "canvas-launch");
    const name = `Launch ${randomUUID().slice(0, 8)}`;
    await page.goto("/launch");
    await page.getByLabel("Name this launch").fill(name);
    await page.getByRole("button", { name: "Start the launch" }).click();
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    const id = /\/project\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";

    await page.goto(`/launch/${id}?panel=mockups`);
    await expect(page).toHaveURL(new RegExp(`/project/${id}\\?panel=mockups`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });
});

import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * The garment inspector on the one canvas (plan v6 E3, decision 0147; `08` §5.3, e15, e41):
 *
 *   * selecting a garment board shows its Product, Options, Colourways, Names & numbers, Checks and
 *     Price, read from the design;
 *   * a change made there goes through the editor's own action and is validated and kept;
 *   * a layer can be opened in the element inspector and left again;
 *   * Product info opens and closes; the full editor stays one press away.
 */

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}\?focus=garment$/);
  return /\/project\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
};

/**
 * Selects the garment board from the keyboard. A key pressed before the canvas has hydrated does
 * nothing (CI showed the first press lost), so the press is repeated until the selection lands.
 */
const selectGarment = async (page: Page): Promise<void> => {
  const board = page.locator("[data-board-id]").first();
  await expect(async () => {
    await board.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("selection-inspector")).toHaveAttribute("data-target", "garment", { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByTestId("garment-inspector")).toBeVisible({ timeout: 30_000 });
};

test.describe("the garment inspector", () => {
  test("shows the selected garment and keeps a change made there", async ({ page }) => {
    await signIn(page, await createAccount("garment-inspector"));
    // Sign-in lands on the recent projects first; going on before it does races the session cookie.
    await expect(page).toHaveURL(/\/projects\/recent$/);
    const id = await startDesign(page, `Inspector kit ${randomUUID().slice(0, 6)}`);
    await page.goto(`/project/${id}`);
    await selectGarment(page);

    const inspector = page.getByTestId("selection-inspector");
    await expect(inspector).toHaveAttribute("data-target", "garment");
    await expect(inspector.getByRole("heading", { name: "Product", exact: true })).toBeVisible();
    await expect(inspector.getByRole("heading", { name: "Options" })).toBeVisible();
    await expect(inspector.getByRole("heading", { name: "Colourways" })).toBeVisible();
    await expect(inspector.getByRole("heading", { name: "Checks" })).toBeVisible();
    await expect(page.getByTestId("garment-checks-summary")).not.toBeEmpty();
    await expect(page.getByTestId("garment-price-steps")).toContainText("1 pc");

    // Names and numbers on: a change through the editor's own action, stored as a new version.
    const marks = page.getByTestId("garment-names-numbers").getByRole("switch", { name: "Names and numbers" });
    await expect(marks).toHaveAttribute("aria-checked", "false");
    await marks.click();
    await expect(marks).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });

    // The marks are layers now: one opens in the element inspector, and Back returns to the garment.
    await page.getByTestId("garment-layers").getByRole("button").first().click();
    await expect(page.getByTestId("element-inspector-player-mark")).toBeVisible();
    await page.getByTestId("element-back").click();
    await expect(page.getByTestId("garment-inspector")).toBeVisible();

    // Product info opens over the canvas and closes with Escape.
    await page.getByTestId("product-info-open").click();
    await expect(page.getByTestId("product-info")).toBeVisible();
    await expect(page.getByTestId("product-info-cost")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("product-info")).toBeHidden();

    // A reload reads the stored design: the change was kept.
    await page.reload();
    await selectGarment(page);
    await expect(page.getByTestId("garment-names-numbers").getByRole("switch", { name: "Names and numbers" })).toHaveAttribute("aria-checked", "true");

    const results = await new AxeBuilder({ page }).include('[data-testid="selection-inspector"]').analyze();
    const serious = results.violations.filter((one) => one.impact === "serious" || one.impact === "critical");
    expect(serious.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);

    // The full editor stays one press away, in place on the canvas: the link names the canvas's own
    // id (the design's home canvas, which `/project/<design id>` opened) and the garment board.
    await inspector.getByRole("link", { name: "Open in Garment Studio" }).click();
    await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}\?focus=[0-9a-f-]{36}/);
    await expect(page.getByTestId("canvas-focus-back")).toBeVisible();
  });
});

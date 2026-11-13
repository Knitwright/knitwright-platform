import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { accessible } from "./chrome";
import { createAccount, showStudioWelcome, signIn, test } from "./support";

/**
 * Plan v6 G1 (decision 0150): Garment Studio, the focused garment on the one canvas. The library
 * column and its panels, the stage's pills and Fit checked, the Export panel with its checklist and
 * its upgrade, the beta welcome, and the fixture at 1440 × 900.
 *
 * Each test makes its own account and its own design name (plan v5, lesson 11).
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

const startJersey = async (page: Page, label: string): Promise<string> => {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}\?focus=garment$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return /\/project\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
};

test.describe("Garment Studio", () => {
  test("opens a library panel from the column, keeps it in the address, and closes back to the toolbar", async ({ page }) => {
    await signedIn(page, "studio-shelves");
    const id = await startJersey(page, "Shelf kit");

    const column = page.getByTestId("studio-library-column");
    await expect(column.getByRole("region", { name: "Knitwright library" })).toBeVisible();
    await expect(column.getByRole("link", { name: "Tech pack" })).toHaveAttribute("href", `/studio/${id}/tech-pack`);
    await expect(page.getByRole("tablist", { name: "Toolbars" }).getByRole("tab", { name: "Form" })).toHaveAttribute("aria-selected", "true");

    await page.getByTestId("studio-shelf-fabrics").click();
    const fabrics = page.getByTestId("studio-panel-fabrics");
    await expect(fabrics.getByRole("heading", { name: "Fabrics" })).toBeVisible();
    await expect(fabrics.getByRole("button", { name: "Mesh" })).toBeVisible();
    await expect(page).toHaveURL(/[?&]shelf=fabrics/);
    await expect(page.getByTestId("studio-shelf-fabrics")).toHaveAttribute("aria-pressed", "true");
    await accessible(page, '[data-testid="garment-studio"]');

    // A print-safe colour goes on every panel through the editor's own save.
    await page.getByTestId("studio-shelf-colours").click();
    await page.getByTestId("studio-print-safe").getByRole("button").first().click();
    await expect(page.getByTestId("save-status")).toHaveText("Saved as version 2.");

    await page.getByRole("button", { name: "Close Colours" }).click();
    await expect(page).not.toHaveURL(/shelf=/);
    await expect(page.getByTestId("form-toolbar")).toBeVisible();
  });

  test("shows Fit checked and the stage's pills, and the Export panel's checklist leads to the upgrade", async ({ page }) => {
    await signedIn(page, "studio-export");
    await startJersey(page, "Export kit");

    await expect(page.getByTestId("fit-checked")).toBeVisible();
    await expect(page.getByTestId("colourway-pill")).toContainText("Main colourway");

    await page.getByTestId("export-button").click();
    const panel = page.getByTestId("studio-export");
    await expect(panel.getByRole("tab")).toHaveText(["Tech pack", "Images", "Pattern", "Artwork", "On model", "Flat lay"]);
    await expect(panel.getByTestId("studio-export-checklist").getByRole("listitem")).toHaveCount(8);
    await expect(panel.getByTestId("studio-export-note")).toContainText("You don't need to export");

    await panel.getByRole("tab", { name: "Pattern" }).click();
    await expect(panel).toContainText("Class A patterns stay with the factory");

    // Every brand is on Free until checkout records a plan: Export ♛ opens Upgrade to export tech packs.
    await panel.getByTestId("studio-export-go").click();
    await expect(page.getByTestId("plans-modal-techpack")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Upgrade to export tech packs" })).toBeVisible();
  });

  test("welcomes a first visit once, and not again after Don't show this again", async ({ page }) => {
    await signedIn(page, "studio-welcome");
    await startJersey(page, "Welcome kit");

    await showStudioWelcome(page);
    await page.reload();
    const welcome = page.getByRole("dialog", { name: "Welcome to Garment Studio" });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByText("Works well")).toBeVisible();
    await expect(welcome.getByLabel("Don't show this again")).toBeChecked();
    await accessible(page);

    await welcome.getByRole("button", { name: "Start designing" }).click();
    await expect(welcome).toBeHidden();
    await page.reload();
    await expect(page.getByTestId("garment-studio")).toBeVisible();
    await expect(welcome).toHaveCount(0);
  });

  test("draws the fixture at 1440 × 900 with the four columns side by side", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dev/garment-studio?shelf=fabrics");
    const boxes = await Promise.all(
      ["studio-library-column", "studio-panel-fabrics", "studio-stage", "design-summary"].map(async (testId) => page.getByTestId(testId).boundingBox()),
    );
    const [column, panel, stage, summary] = boxes.map((box) => box!);
    expect(Math.round(column.width)).toBe(236);
    expect(Math.round(panel.width)).toBe(380);
    expect(panel.x).toBeGreaterThanOrEqual(column.x + column.width - 1);
    expect(stage.x).toBeGreaterThanOrEqual(panel.x + panel.width - 1);
    expect(summary.x).toBeGreaterThan(stage.x);
    await accessible(page);
  });
});

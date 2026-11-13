import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { readWorkbook } from "../lib/techpack/exports/fixtures/xlsx-read";
import { createAccount, signIn, test } from "./support";

/**
 * Plan v6 G2, decision 0151: the tech pack editor (spec screen 30) and its sheets (screen 31) on the
 * design's `/tech-pack` page, above the factory file. Seven tabs, mm / cm / in, the red points and
 * blue callouts on the garment, a callout added on the garment and kept after a reload, Check fit,
 * and the eight-sheet .xlsx the preview shows.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

/** A jersey on JSY-SS-01, and the address of its tech pack page. */
const startJersey = async (page: Page, label: string): Promise<string> => {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return `${new URL(page.url()).pathname.replace("/project/", "/studio/")}/tech-pack`;
};

test.describe("the tech pack editor (screens 30 and 31)", () => {
  test("draws the seven tabs, the graded measurements in the chosen unit, and the points on the garment", async ({ page }) => {
    await signedIn(page, "g2-editor");
    await page.goto(await startJersey(page, "Tech pack editor"));

    const editor = page.getByTestId("techpack-editor");
    const tabs = editor.getByRole("tablist", { name: "Tech pack tabs" });
    await expect(tabs.getByRole("tab")).toHaveText(["Overview", "Body", "Measurements", "Materials", "Callouts", "Artworks", "Labels"]);
    await expect(editor.getByTestId("tp-review")).toBeVisible();

    await editor.getByTestId("tp-point-A").click();
    await expect(tabs.getByRole("tab", { name: "Measurements" })).toHaveAttribute("aria-selected", "true");
    await expect(editor.getByTestId("tp-stage-chip")).toHaveText("Measurement · A");

    const table = editor.getByTestId("tp-measurements");
    await expect(table.getByRole("columnheader", { name: /^M/ })).toBeVisible();
    await editor.getByRole("radio", { name: "millimetres" }).click();
    await expect(table.getByRole("row", { name: /Chest width/ })).toContainText("520");
    await editor.getByRole("radio", { name: "centimetres" }).click();
    await expect(table.getByRole("row", { name: /Chest width/ })).toContainText("52.0");
    await expect(table.getByTestId("tp-part-qc")).toContainText("Knitwright QC only");

    await editor.getByRole("button", { name: "Check fit" }).click();
    await expect(page.getByTestId("tp-fit")).toContainText("XS–3XL");

    const results = await new AxeBuilder({ page }).include('[data-testid="techpack-editor"]').analyze();
    const serious = results.violations.filter((one) => one.impact === "serious" || one.impact === "critical");
    expect(serious.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test("adds a callout on the garment, keeps it after a reload, and takes it off again", async ({ page }) => {
    await signedIn(page, "g2-callout");
    const address = await startJersey(page, "Callout kit");
    await page.goto(`${address}?tab=callouts`);

    const editor = page.getByTestId("techpack-editor");
    const before = await editor.getByRole("button", { name: /^Show callout \d+ on the garment$/ }).count();
    await editor.getByTestId("tp-add-callout").click();
    await editor.getByTestId("tp-stage-drawing").click({ position: { x: 12, y: 12 } });
    await editor.getByLabel("The callout's note").fill("Crest centred on the chest");
    await editor.getByRole("button", { name: "Add callout", exact: true }).click();
    await expect(editor.getByRole("cell", { name: "Crest centred on the chest" })).toBeVisible();

    await page.reload();
    await expect(editor.getByRole("cell", { name: "Crest centred on the chest" })).toBeVisible();
    const added = before + 1;
    await editor.getByRole("button", { name: `Delete callout ${added}` }).click();
    await expect(editor.getByRole("cell", { name: "Crest centred on the chest" })).toHaveCount(0);
  });

  test("previews the eight sheets, and the eight-sheet .xlsx carries them under one header", async ({ page }) => {
    await signedIn(page, "g2-sheets");
    const address = await startJersey(page, "Sheets kit");
    await page.goto(address);

    await page.getByTestId("tp-preview-sheets").click();
    const sheets = page.getByRole("dialog");
    const names = ["Overview", "Colourways", "Measurements", "Size chart", "Callouts", "Materials", "Artworks", "Labels"];
    await expect(sheets.getByRole("tablist", { name: "Sheets" }).getByRole("tab")).toHaveText(names);
    await sheets.getByRole("tab", { name: "Size chart" }).click();
    await expect(sheets.getByTestId("tp-sheet-size-chart")).toContainText(/Size chart \((MM|CM|IN)\) · garment measurements/);
    await expect(sheets.getByTestId("tp-sheet-size-chart")).toContainText("Open in Knitwright");
    // Free has no tech pack exports: the download is ♛ and opens the upgrade.
    await expect(sheets.getByTestId("tp-download-xlsx")).toHaveAccessibleName(/needs a plan/);

    // The same file through the export route the download uses.
    const id = /\/studio\/([0-9a-f-]{36})\//.exec(address)?.[1] ?? "";
    const response = await page.request.get(`/api/projects/${id}/exports/xlsx?layout=sheets`);
    expect(response.status()).toBe(200);
    const book = await readWorkbook(new Uint8Array(await response.body()));
    expect(book.map((sheet) => sheet.sheet)).toEqual(names);
    for (const sheet of book) expect(sheet.data.flat(), sheet.sheet).toContain("Open in Knitwright");
  });
});

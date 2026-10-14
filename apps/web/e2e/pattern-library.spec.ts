import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * The pattern library (plans/production-outputs.md, W1): the owner uploads the benchmark jersey's
 * DXF as a size set and sees the table of points measured on the pattern. The file is the real
 * fashionINSTA output kept in docs/owner/reference.
 */

const BENCHMARK_DXF = join(__dirname, "../../../docs/owner/reference/fashioninsta-2026-10-14/pattern_1598.dxf");

const openMakeIt = async (page: Page, name: string): Promise<void> => {
  await signIn(page, await createAccount("pattern-library"));
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.goto(`${new URL(page.url()).pathname}?tool=production`);
  await expect(page.getByRole("heading", { name: "Patterns" })).toBeVisible();
};

test.describe("the pattern library (W1)", () => {
  test("an upload is stored as a draft and its measured table is shown", async ({ page }) => {
    await openMakeIt(page, "Library test");
    await expect(page.getByText("No pattern yet: needs a technician's draft or your DXF.").first()).toBeVisible();

    const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Add a pattern from DXF files" }) });
    await form.getByLabel("Product").selectOption({ label: "Crew tee" });
    await form.getByLabel("Does the outline already include seam allowance?").selectOption({ label: "No: the outline is the sewn size (add seam allowance)" });
    await form.getByLabel("DXF files").setInputFiles(BENCHMARK_DXF);
    await form.getByRole("button", { name: "Add the pattern" }).click();
    await expect(page.getByText(/Stored as version 1: 48\./)).toBeVisible();

    await expect(page.getByText("Draft pattern, not reviewed.").first()).toBeVisible();
    await page.getByRole("button", { name: "See the measurements" }).click();
    const table = page.getByRole("table", { name: "Measured on the pattern, in centimetres" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("row", { name: /^Chest width/ })).toContainText("50.7");
    await expect(table.getByRole("row", { name: /^Sleeve cap height/ })).toContainText("13.8");
    await expect(table).not.toContainText("confirm");
    await expect(page.getByRole("link", { name: "DXF, size 48" })).toBeVisible();
  });
});

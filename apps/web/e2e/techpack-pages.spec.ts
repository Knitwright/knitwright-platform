import { readFileSync } from "node:fs";
import { expect, type Download, type Page } from "@playwright/test";
import { readPages } from "../lib/techpack/exports/fixtures/pdf-pages";
import { readWorkbook } from "../lib/techpack/exports/fixtures/xlsx-read";
import { CLOSING_PAGES, TECH_PACK_PAGES } from "../lib/techpack/exports/pages";
import { TECH_PACK_TABS } from "../lib/techpack/exports/tabs";
import { createAccount, signIn, test } from "./support";

/**
 * Plan v5 Y5, decision 0078: the tech pack PDF is laid out as the sixteen pages of F-S6, each with
 * the header block and a "Page x of y" footer, and the Excel file has one sheet per tab of the tech
 * pack view. This is the same file a person really downloads, read back page by page.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/studio$/);
};

const startDesign = async (page: Page, name: string): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

const openTechPack = async (page: Page): Promise<void> => {
  await page.getByRole("link", { name: "Tech pack" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\/tech-pack$/);
  await expect(page.getByRole("group", { name: "Download this tech pack" }).getByRole("button", { name: "Download PDF" })).toBeVisible();
};

const press = async (page: Page, name: string): Promise<Download> => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
  return download;
};

const bytesOf = async (download: Download): Promise<Buffer> => readFileSync((await download.path()) ?? "");

test.describe("the sixteen pages of the tech pack (F-S6)", () => {
  test("the downloaded PDF holds the sixteen pages in order, each with the header block and the page count", async ({ page }) => {
    // A name of this run only, so a retry never reads a file of the attempt before it.
    const name = `Pages ${Date.now()}`;
    await signedIn(page, "y5-pdf-pages");
    await startDesign(page, name);
    await openTechPack(page);

    const pages = await readPages(new Uint8Array(await bytesOf(await press(page, "Download PDF"))));
    const text = pages.map((entry) => entry.text).join(" ");
    let from = 0;
    for (const planned of [...TECH_PACK_PAGES, ...CLOSING_PAGES]) {
      const at = text.indexOf(planned.title, from);
      expect(at, planned.id).toBeGreaterThanOrEqual(from);
      from = at;
    }
    for (const sheet of pages) {
      for (const label of ["Brand", "Style number", "Season", "Base size", "Version"]) {
        expect(sheet.text, `${label} on sheet ${sheet.number}`).toContain(label);
      }
      expect(sheet.text).toContain(`Page ${sheet.number} of ${pages.length}`);
    }
    // Each of the sixteen starts a sheet of paper of its own.
    expect(pages.length).toBeGreaterThanOrEqual(TECH_PACK_PAGES.length);
  });

  test("the downloaded Excel file holds one sheet per tab of the tech pack view, each headed by its name", async ({ page }) => {
    const name = `Sheets ${Date.now()}`;
    await signedIn(page, "y5-xlsx-tabs");
    await startDesign(page, name);
    await openTechPack(page);

    const sheets = await readWorkbook(new Uint8Array(await bytesOf(await press(page, "Download Excel"))));
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(TECH_PACK_TABS.map((tab) => tab.sheet));
    for (const sheet of sheets) {
      expect(sheet.data.flat(), sheet.sheet).toContain(sheet.sheet);
    }
  });
});

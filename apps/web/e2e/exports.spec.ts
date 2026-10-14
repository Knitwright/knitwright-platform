import { readFileSync } from "node:fs";
import { expect, type Download, type Page } from "@playwright/test";
import { readPages } from "../lib/techpack/exports/fixtures/pdf-pages";
import { createAccount, downloadRecords, openTool, signIn, standInForBotCheck, test } from "./support";

/**
 * Plan step 9: the tech pack as a PDF, an Excel file and two SVG drawings. Each is built when it is
 * asked for, the download is recorded, and nothing is stored. A member of another brand gets nothing.
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

const openTechPack = async (page: Page): Promise<string> => {
  await page.getByRole("link", { name: "Tech pack" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\/tech-pack$/);
  // The downloads are in the header of the factory file, whichever section is shown.
  await expect(page.getByRole("group", { name: "Download this tech pack" }).getByRole("button", { name: "Download PDF" })).toBeVisible();
  return /\/studio\/([0-9a-f-]{36})\//.exec(page.url())?.[1] ?? "";
};

/** A design with a typed measurement, so it is at version 2, with its tech pack open. Returns the design id. */
const designWithTechPack = async (page: Page, label: string, name: string): Promise<string> => {
  await signedIn(page, label);
  await startDesign(page, name);
  await openTool(page, "Sizes");
  const chest = page.getByLabel("Chest width in centimetres");
  await chest.fill("52.5");
  await chest.press("Enter");
  await expect(page.getByTestId("save-status")).toHaveText("Saved as version 2.");
  return openTechPack(page);
};

const press = async (page: Page, name: string): Promise<Download> => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
  return download;
};

const bytesOf = async (download: Download): Promise<Buffer> => readFileSync((await download.path()) ?? "");

test.describe("downloading the tech pack (T12)", () => {
  test("a member downloads the PDF, the Excel file and both drawings, under the right names, and each is recorded", async ({ page }) => {
    const projectId = await designWithTechPack(page, "dl-member", "Export test");

    const pdf = await press(page, "Download PDF");
    // The browser saves under the UTF-8 name, which keeps the space of the design name.
    expect(pdf.suggestedFilename()).toBe("Export test-v2-tech-pack.pdf");
    const pdfBytes = await bytesOf(pdf);
    expect(pdfBytes.subarray(0, 4).toString("latin1")).toBe("%PDF");
    const pages = await readPages(new Uint8Array(pdfBytes));
    expect(pages.map((entry) => entry.text).join(" ")).toContain("Export test");
    expect(pages[0]?.text).toContain("Version 2");
    // The PDF marks each value with the number of its source, and lists the words of each mark once,
    // in the key of "Sources and notes" at the end.
    const pdfText = pages.map((entry) => entry.text).join(" ");
    const key = pdfText.slice(pdfText.lastIndexOf("Sources and notes"));
    const typedMark = /\[(\d+)\] Typed in by you/.exec(key)?.[1];
    expect(typedMark).toBeDefined();
    expect(pdfText).toContain(`52.5 cm [${typedMark}]`);

    const excel = await press(page, "Download Excel");
    expect(excel.suggestedFilename()).toBe("Export test-v2-tech-pack.xlsx");
    expect((await bytesOf(excel)).subarray(0, 2).toString("latin1")).toBe("PK");

    const front = await press(page, "Download SVG front");
    expect(front.suggestedFilename()).toBe("Export test-v2-front.svg");
    const frontText = (await bytesOf(front)).toString("utf8");
    expect(frontText.startsWith("<?xml")).toBe(true);
    expect(frontText).toContain("<svg");
    expect(frontText).toContain('inkscape:groupmode="layer"');

    const back = await press(page, "Download SVG back");
    expect(back.suggestedFilename()).toBe("Export test-v2-back.svg");
    expect((await bytesOf(back)).toString("utf8").startsWith("<?xml")).toBe(true);

    const records = await downloadRecords(projectId);
    expect(records.map((entry) => [entry.spec_version, entry.format, entry.view])).toEqual([
      [2, "pdf", null],
      [2, "xlsx", null],
      [2, "svg", "front"],
      [2, "svg", "back"],
    ]);
  });

  test("can be done from the keyboard, and the button is focused again when the file is saved", async ({ page }) => {
    await designWithTechPack(page, "dl-keyboard", "Keyboard test");
    const button = page.getByRole("button", { name: "Download Excel" });

    await button.focus();
    const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);

    expect(download.suggestedFilename()).toBe("Keyboard test-v2-tech-pack.xlsx");
    await expect(button).toBeFocused();
  });

  test("says what is being made while it works, and blocks a second press", async ({ page }) => {
    await designWithTechPack(page, "dl-busy", "Busy test");
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/exports/pdf**", async (route) => {
      await gate;
      await route.continue();
    });

    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();

    await expect(page.getByTestId("download-status")).toHaveText("Preparing the PDF. This can take a few seconds.");
    await expect(page.getByRole("button", { name: "Download PDF" })).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: "Download Excel" })).toBeDisabled();

    release();
    await pending;
    await expect(page.getByTestId("download-status")).toHaveText("");
    await expect(page.getByRole("button", { name: "Download Excel" })).toBeEnabled();
  });

  test("says in a plain sentence when a download fails, and does not save anything", async ({ page }) => {
    await designWithTechPack(page, "dl-failure", "Failure test");
    const cases: readonly [number, unknown, string][] = [
      [401, { success: false, error: { code: "unauthenticated", message: "Sign in to continue." } }, "Your session has ended. Sign in again to download this file."],
      [404, { success: false, error: { code: "not_found", message: "That design does not exist." } }, "That design does not exist."],
      [429, { success: false, error: { code: "rate_limited", message: "Too many requests." } }, "Too many downloads. Wait a moment and try again."],
      [500, { success: false, error: { code: "internal", message: "Something went wrong on our side. Try again." } }, "The file could not be built. Try again in a moment."],
    ];
    let downloads = 0;
    page.on("download", () => {
      downloads += 1;
    });

    for (const [status, body, sentence] of cases) {
      await page.route("**/exports/pdf**", (route) => route.fulfill({ status, json: body as object }));
      await page.getByRole("button", { name: "Download PDF" }).click();
      await expect(page.getByTestId("download-problem")).toHaveText(sentence);
      await expect(page.getByRole("alert").filter({ hasText: sentence })).toBeVisible();
      await page.unroute("**/exports/pdf**");
    }

    await page.route("**/exports/pdf**", (route) => route.abort("failed"));
    await page.getByRole("button", { name: "Download PDF" }).click();
    await expect(page.getByTestId("download-problem")).toHaveText("We could not reach the server. Check your connection and try again.");
    expect(downloads).toBe(0);
  });

  test("sends every file with headers that keep it from being run or cached, and an SVG under a sandbox", async ({ page }) => {
    const projectId = await designWithTechPack(page, "dl-headers", "Headers test");
    const base = `/api/projects/${projectId}/exports`;

    const pdf = await page.request.get(`${base}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()).toMatchObject({
      "content-type": "application/pdf",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    expect(pdf.headers()["content-disposition"]).toBe(
      `attachment; filename="Headers-test-v2-tech-pack.pdf"; filename*=UTF-8''Headers%20test-v2-tech-pack.pdf`,
    );
    expect(Number(pdf.headers()["content-length"])).toBe((await pdf.body()).byteLength);

    const svg = await page.request.get(`${base}/svg?view=front&version=1`);
    expect(svg.status()).toBe(200);
    expect(svg.headers()["content-type"]).toBe("image/svg+xml; charset=utf-8");
    expect(svg.headers()["content-disposition"]).toContain('attachment; filename="Headers-test-v1-front.svg"');
    expect(svg.headers()["content-security-policy"]).toContain("sandbox");
    expect(svg.headers()["content-security-policy"]).toContain("default-src 'none'");
  });

  test("refuses an address that is not valid, and a version the design does not have", async ({ page }) => {
    const projectId = await designWithTechPack(page, "dl-invalid", "Invalid test");
    const base = `/api/projects/${projectId}/exports`;

    expect((await page.request.get(`${base}/svg`)).status()).toBe(400);
    expect((await page.request.get(`${base}/pdf?view=front`)).status()).toBe(400);
    expect((await page.request.get(`${base}/docx`)).status()).toBe(400);
    expect((await page.request.get(`/api/projects/not-an-id/exports/pdf`)).status()).toBe(400);
    const missing = await page.request.get(`${base}/pdf?version=9`);
    expect(missing.status()).toBe(404);
    expect((await missing.json()).error.code).toBe("not_found");
    expect(await downloadRecords(projectId)).toEqual([]);
  });

  test("a member of another brand cannot download it, and nothing is recorded", async ({ page, browser }) => {
    const projectId = await designWithTechPack(page, "dl-owner", "Private design");
    const other = await browser.newContext();
    await standInForBotCheck(other);
    try {
      const stranger = await other.newPage();
      await stranger.setExtraHTTPHeaders({ "x-real-ip": "10.99.0.7" });
      await signIn(stranger, await createAccount("dl-stranger"));
      await expect(stranger).toHaveURL(/\/studio$/);

      for (const format of ["pdf", "xlsx", "svg?view=front"]) {
        const refused = await stranger.request.get(`/api/projects/${projectId}/exports/${format}`);
        expect(refused.status(), format).toBe(404);
        expect(await refused.json()).toEqual({ success: false, error: { code: "not_found", message: "That design does not exist." } });
      }
      expect(await downloadRecords(projectId)).toEqual([]);

      await stranger.goto(`/studio/${projectId}/tech-pack`);
      await expect(stranger.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
    } finally {
      await other.close();
    }
  });
});

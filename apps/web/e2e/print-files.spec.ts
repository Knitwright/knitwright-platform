import { expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { createAccount, signIn, test } from "./support";

/**
 * Print files (plan W3, phase A): a member downloads one zip of print files for a design. It is drawn when asked for and
 * nothing is stored. A design with no pattern yet is told so in plain words. User artwork through the new intake is phase B.
 */

const startDesign = async (page: Page, type: string, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: type });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return /\/studio\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
};

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

test.describe("print files", () => {
  test("a member downloads the jersey's print zip with a manifest and a note that says it is a draft", async ({ page }) => {
    await signIn(page, await createAccount("print-files"));
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Team jersey", "Print files test");

    const response = await page.request.get(`/api/projects/${projectId}/print-files?sizes=48&view=collar,back&format=pdf,svg`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/zip");
    expect(response.headers()["content-disposition"]).toContain("print-files.zip");
    const files = unzipSync(new Uint8Array(await response.body()));
    const names = Object.keys(files);
    expect(names.some((n) => n.endsWith("/pieces/collar_48.pdf"))).toBe(true);
    expect(names.some((n) => n.endsWith("/pieces/back_48.svg"))).toBe(true);
    expect(names.some((n) => n.endsWith("/manifest.csv"))).toBe(true);
    const readme = names.find((n) => n.endsWith("/README.txt"));
    expect(text(files[readme ?? ""])).toContain("Draft pattern, not reviewed.");
    const svg = names.find((n) => n.endsWith("/pieces/collar_48.svg"));
    expect(text(files[svg ?? ""])).not.toMatch(/<script|onload=/i);
  });

  test("a size the pattern does not have is refused in plain words", async ({ page }) => {
    await signIn(page, await createAccount("print-no-pattern"));
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Team jersey", "Another jersey");
    const bad = await page.request.get(`/api/projects/${projectId}/print-files?sizes=99`);
    expect(bad.status()).toBe(400);
    expect(await bad.text()).toContain("This pattern has no size 99");
  });

  test("another brand's design is not found", async ({ page }) => {
    await signIn(page, await createAccount("print-other"));
    await expect(page).toHaveURL(/\/studio$/);
    const missing = await page.request.get("/api/projects/00000000-0000-4000-8000-000000000000/print-files");
    expect(missing.status()).toBe(404);
  });
});

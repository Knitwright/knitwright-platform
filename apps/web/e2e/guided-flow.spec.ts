import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Download, type Page } from "@playwright/test";
import sharp from "sharp";
import { createAccount, signIn, test } from "./support";

/**
 * Plan step 15 acceptance: one path from a sentence, and one from a sketch, to all four
 * downloads, with the assistant's model replaced by the stand-in (AI_PROVIDER_STUB=on in
 * playwright.config.ts, lib/providers/stand-in.ts). One garment of each family goes the
 * sentence path. Every step is checked for accessibility problems a machine can find.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/studio$/);
};

/** No problem axe calls serious or critical on the page as it stands. */
const accessible = async (page: Page): Promise<void> => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(serious.map((entry) => `${entry.id}: ${entry.help}`)).toEqual([]);
};

const next = async (page: Page, step: string): Promise<void> => {
  await page.getByRole("link", { name: `Next: ${step}` }).click();
  await expect(page).toHaveURL(new RegExp(`step=${step.toLowerCase()}`));
  await expect(page.getByRole("heading", { level: 2, name: step })).toBeFocused();
  await accessible(page);
};

const press = async (page: Page, name: string): Promise<Download> => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name }).click()]);
  return download;
};

const bytesOf = async (download: Download): Promise<Buffer> => readFileSync((await download.path()) ?? "");

/** Review, adjust and download: the path after the start is the same however the design began. */
const reviewAdjustDownload = async (page: Page): Promise<void> => {
  await next(page, "Review");
  const preview = page.getByTestId("live-preview");
  await expect(preview.getByRole("img").first()).toBeVisible();
  await preview.getByLabel("Inches").check();
  await expect(page).toHaveURL(/unit=in/);
  await expect(preview.getByRole("table")).toContainText(/ in|Not given yet/);
  await expect(preview.getByRole("table")).not.toContainText(/ cm\b/);

  await next(page, "Adjust");
  await next(page, "Download");

  expect((await bytesOf(await press(page, "Download PDF"))).subarray(0, 4).toString("latin1")).toBe("%PDF");
  expect((await bytesOf(await press(page, "Download Excel"))).subarray(0, 2).toString("latin1")).toBe("PK");
  expect((await bytesOf(await press(page, "Download SVG front"))).toString("utf8")).toContain("<svg");
  expect((await bytesOf(await press(page, "Download SVG back"))).toString("utf8")).toContain("<svg");
};

const SENTENCES = [
  { family: "tops", sentence: "A polo shirt for women, slim fit with long sleeves", garment: "Polo shirt for women" },
  { family: "bottoms", sentence: "Joggers for kids for our football club, slim fit", garment: "Joggers for youth" },
  { family: "outerwear", sentence: "A zip hoodie for the team, slim fit", garment: "Zip hoodie for men" },
  { family: "close-fitting", sentence: "A running singlet for women with a racerback", garment: "Singlet for women" },
] as const;

test.describe("the guided flow", () => {
  for (const { family, sentence, garment } of SENTENCES) {
    test(`goes from one sentence to all four downloads (${family})`, async ({ page }) => {
      await signedIn(page, `guided-${family}`);
      await page.getByRole("link", { name: "Start a design, step by step" }).click();
      await expect(page).toHaveURL(/\/studio\/start$/);
      await accessible(page);

      await page.getByRole("radio", { name: /Team kit/ }).check();
      await page.getByLabel("What do you want to make?").fill(sentence);
      await page.getByRole("button", { name: "Start from these words" }).click();
      await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\/guide\?step=start/);
      await expect(page.getByTestId("chat-applied")).toBeVisible();
      // The sentence is sent once: the address forgets it, so a reload sends nothing.
      await expect(page).not.toHaveURL(/say=/);
      await expect(page.getByText(new RegExp(garment, "i")).first()).toBeVisible();
      await accessible(page);

      await reviewAdjustDownload(page);
    });
  }

  test("goes from a sketch to all four downloads", async ({ page }) => {
    await signedIn(page, "guided-sketch");
    await page.goto("/studio/start");
    await page.getByRole("radio", { name: /Upload my design/ }).check();
    await page.getByRole("button", { name: "Start from a picture" }).click();
    await expect(page).toHaveURL(/\/guide\?step=start&from=sketch/);
    await accessible(page);

    const sketch = await sharp({ create: { width: 320, height: 320, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await page.getByLabel("Choose a picture").setInputFiles({ name: "polo-sketch.png", mimeType: "image/png", buffer: sketch });
    const proposal = page.getByTestId("image-proposal");
    await expect(proposal).toBeVisible();
    for (const box of await proposal.getByRole("checkbox").all()) await box.check();
    await page.getByRole("button", { name: "Apply this design" }).click();
    await expect(page.getByText("The design was applied and saved as a new version.")).toBeVisible();
    await expect(page.getByText(/Polo shirt for men/i).first()).toBeVisible();

    await reviewAdjustDownload(page);
  });

  test("keeps every step usable by keyboard, and names the current step", async ({ page }) => {
    await signedIn(page, "guided-keys");
    await page.goto("/studio/start");
    await page.getByRole("radio", { name: /Launch a brand/ }).focus();
    await page.keyboard.press("Space");
    await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
    await page.getByLabel("Made for").selectOption({ label: "Women" });
    await page.getByRole("button", { name: "Start from this garment" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/step=start&from=picker/);
    const steps = page.getByRole("navigation", { name: "Steps" });
    await expect(steps.getByRole("link", { name: "Start", exact: true })).toHaveAttribute("aria-current", "step");
    await page.getByRole("link", { name: "Next: Review" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Review" })).toBeFocused();
  });
});

test.describe("the guided flow with less motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("moves nothing when the system asks for less motion", async ({ page }) => {
    await signedIn(page, "guided-motion");
    await page.goto("/studio/start");
    const duration = await page
      .getByRole("button", { name: "Start from these words" })
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThan(0.001);
  });
});

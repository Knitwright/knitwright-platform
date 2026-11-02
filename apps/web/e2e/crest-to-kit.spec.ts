import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { createAccount, signIn, test } from "./support";

/**
 * Crest to kit and the quote (spec F-T2, F-T5). The acceptance tests of both features are here: a
 * crest yields six to nine kits, each one validated before it is shown; the kits open in the
 * configurator; and the quote comes down as a PDF in under five seconds.
 *
 * Each test signs in as its own brand, so no two runs of this file can find each other's rows
 * (Lesson 11). The crest is drawn here by `sharp`: no club's artwork is committed.
 *
 * The sign-in button is only pressed by `signIn`; the session cookie arrives with the redirect
 * that answers it, so the redirect has to land before anything navigates away. That is what
 * waiting for `/studio` proves — `/crest-to-kit` guards itself with `requireMember`, and a `goto`
 * sent while the redirect is in flight runs as a visitor and is sent to sign in instead.
 */

/** A crest of three flat bands, so the palette must read back exactly those three colours. */
const crest = async (): Promise<Buffer> => {
  const width = 300;
  const height = 300;
  const band = Math.round(width / 3);
  return sharp({ create: { width, height, channels: 3, background: "#1b2a49" } })
    .composite([
      { input: { create: { width: band, height, channels: 3, background: "#d4af37" } }, left: band, top: 0 },
      { input: { create: { width: band, height, channels: 3, background: "#c8102e" } }, left: band * 2, top: 0 },
    ])
    .png()
    .toBuffer();
};

const openCrestToKit = async (page: Page, email: string): Promise<void> => {
  await signIn(page, email);
  await expect(page).toHaveURL(/\/studio$/);
  await page.goto("/crest-to-kit");
  await expect(page.getByTestId("crest-to-kit")).toBeVisible();
};

/** Chooses the crest and presses the one button that fills the screen. */
const buildKits = async (page: Page): Promise<void> => {
  await page.getByLabel("Your club crest").setInputFiles({ name: "crest.png", mimeType: "image/png", buffer: await crest() });
  await page.getByRole("button", { name: /Show me kits/ }).click();
  await expect(page.getByTestId("crest-to-kit-kits")).toBeVisible({ timeout: 30_000 });
};

test.describe("crest to kit", () => {
  test("a crest yields six to nine kits, each checked first, and a card opens that kit in the configurator", async ({ page }) => {
    await openCrestToKit(page, await createAccount("crest-to-kit", { brand: "Crestfield Town" }));

    // The screen has one heading and an empty state naming the one action that fills it.
    await expect(page.getByRole("heading", { level: 1, name: "Crest to kit" })).toBeVisible();
    await expect(page.getByTestId("crest-to-kit-empty")).toContainText("Upload your crest");
    await expect(page.getByTestId("crest-to-kit-kits")).toHaveCount(0);

    // Every control is labelled, and the feel is a radio group with its own legend.
    await expect(page.getByLabel("Club name (optional)")).toBeVisible();
    await expect(page.getByRole("group", { name: "How it should feel" })).toBeVisible();
    await page.getByRole("radio", { name: "Modern" }).click();

    await buildKits(page);

    // Six to nine kits, which is the specification's own count. The cards are counted by their own
    // test id, not by every list item in the section: each card holds a list of its own warnings.
    const cards = page.getByTestId("crest-to-kit-card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(9);

    // The colours read from the crest are the crest's own, each with what the print estimate said.
    const palette = page.getByTestId("crest-to-kit-palette");
    await expect(palette).toContainText("#1b2a49");
    await expect(palette).toContainText("Navy");
    // The strip says in plain words that there is no Pantone number to give, because the platform
    // holds none; the note under the kits says the sublimation figure is not a colour match.
    await expect(palette).toContainText("no Pantone number can be given");
    await expect(page.getByTestId("crest-to-kit")).toContainText("not a colour match");

    // No delivery date is shown anywhere, because no part of the sum is on file.
    await expect(page.getByTestId("crest-to-kit")).toContainText("No delivery date can be shown yet");
    await expect(page.getByTestId("crest-to-kit")).not.toContainText(/Delivery 20\d\d-/);

    // A card names the catalogue codes the factory reads, and how far it sits from the crest.
    const first = cards.first();
    await expect(first).toContainText(/P0[0-9]/);
    await expect(first).toContainText(/ΔE00/);

    // Clicking a card opens that very kit in the configurator, with its own codes on the address.
    await first.getByRole("link", { name: "Open in the configurator" }).click();
    await expect(page).toHaveURL(/\/teamwear\?.*opt=pattern_fill%3AP0[0-9]/);
    await expect(page.getByTestId("teamwear-configurator")).toBeVisible();
  });

  test("a crest that is too small to print sharp is flagged, and the kits are still offered", async ({ page }) => {
    await openCrestToKit(page, await createAccount("crest-soft", { brand: "Softmark Athletic" }));
    const tiny = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#1b2a49" } })
      .composite([{ input: { create: { width: 30, height: 80, channels: 3, background: "#d4af37" } }, left: 40, top: 0 }])
      .png()
      .toBuffer();
    await page.getByLabel("Your club crest").setInputFiles({ name: "small.png", mimeType: "image/png", buffer: tiny });
    await page.getByRole("button", { name: /Show me kits/ }).click();
    await expect(page.getByTestId("crest-to-kit-kits")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("crest-to-kit")).toContainText("dots per inch");
    await expect(page.getByTestId("crest-to-kit")).toContainText("does not redraw a crest");
  });

  test("a club with no crest file picks its colours instead", async ({ page }) => {
    await openCrestToKit(page, await createAccount("crest-colours", { brand: "Colourway United" }));
    const swatches = page.getByTestId("crest-to-kit-swatches");
    await swatches.getByRole("checkbox", { name: /Navy/ }).click();
    await swatches.getByRole("checkbox", { name: /^Gold/ }).click();
    await page.getByRole("button", { name: /Show me kits/ }).click();
    await expect(page.getByTestId("crest-to-kit-kits")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("crest-to-kit-palette")).toContainText("#1b2a49");
  });

  test("the quote of a kit comes down as a PDF whose numbers are the factory's own", async ({ page }) => {
    await openCrestToKit(page, await createAccount("crest-quote", { brand: "Quoteham Rangers" }));
    await page.getByLabel("Club name (optional)").fill("Quoteham Rangers");
    await buildKits(page);

    const started = Date.now();
    const download = page.waitForEvent("download");
    await page.getByTestId("crest-to-kit-card").first().getByRole("link", { name: "Quote this kit" }).click();
    const file = await download;
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(file.suggestedFilename()).toMatch(/^KWQ-\d{8}-[A-Z2-9]{6}-quote\.pdf$/);
  });
});

test.describe("crest to kit on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the form comes first and the kits stack under it, with no sideways scroll and no axe problem", async ({ page }) => {
    await openCrestToKit(page, await createAccount("crest-phone", { brand: "Pocket Rovers" }));
    await buildKits(page);

    // The order a club fills them in: the form, then its answer.
    const form = await page.getByTestId("crest-to-kit-form").boundingBox();
    const kits = await page.getByTestId("crest-to-kit-kits").boundingBox();
    expect(form?.y ?? 0).toBeLessThan(kits?.y ?? 0);

    // The entrance animations finish first: text that is still fading in fails the contrast rule
    // for a moment, which is why `e2e/mobile.spec.ts` waits the same way before it runs axe.
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
    );

    // The same two measures `e2e/mobile.spec.ts` holds every key screen to (decision 0064).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `crest to kit scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
    // This screen only: the studio shell and its aurora are held to the same bar by
    // `e2e/mobile.spec.ts`, and a failure here should name a node of this workstream's own.
    const { violations } = await new AxeBuilder({ page }).include('[data-testid="crest-to-kit"]').analyze();
    const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
    // The node targets go in the message, so a failure says which element and not only which rule.
    expect(serious.map((entry) => `${entry.id}: ${entry.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

import { expect, type Page } from "@playwright/test";
import { accessible, settled } from "./chrome";
import { createAccount, openTool, signIn, test } from "./support";

/**
 * THE THREE PANELS OF THE DESIGN WORKSPACE THAT HAD NO DOOR (decision 0124).
 *
 * Each one was built, tested and merged, and no screen imported it:
 *
 *   * **design import** (W7d, decision 0038) -- five routes, a whole pipeline and no screen. Its
 *     own record said what it needed: "a line in `lib/workspace/tools.ts` to mount
 *     `DesignImportPanel`". It is a section of the Garment tool now, and it is drawn only while
 *     `DESIGN_IMPORT` is on, which the browser tests switch on (`playwright.config.ts`);
 *   * **your artwork** (W7b, decision 0036) -- the upload Brand Studio's own empty state points at
 *     ("Upload your crest in a design's artwork first, then choose it here"), which did not exist;
 *   * **every pattern we can draw** (W7c, decision 0037) -- "a gallery component for the editor",
 *     reached from the kit style link the Colours tool already carries.
 *
 * Each test reaches its panel the way a person does, from the rail or from a link, and asks for the
 * panel's own words rather than a heading. axe runs over each at a desktop width and at 390 x 844,
 * and nothing is allowed to scroll sideways.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

const startDesign = async (page: Page, name: string, type = "Team jersey"): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: type });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}\?focus=garment$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

const PHONE = { width: 390, height: 844 };

/**
 * Nothing scrolls sideways, at whatever width the test is running. Settled first: the entrance
 * animation lifts and scales what it draws, so a width measured while it plays is not the width a
 * person sees -- the lesson `settled` was written for.
 */
const noSidewaysScroll = async (page: Page): Promise<void> => {
  await settled(page);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sideways).toBeLessThanOrEqual(1);
};

test.describe("reading a design from a picture", () => {
  test("opens from the Garment tool, with the panel's own words and no placeholder", async ({ page }) => {
    await signedIn(page, "import-door");
    await startDesign(page, "Import shirt");

    await openTool(page, "Garment");
    const panel = page.getByTestId("design-import");
    await expect(panel).toBeVisible();

    // The section's own heading, and the panel's own sentences: a close reading, nothing saved yet.
    await expect(page.getByRole("heading", { name: "Read a whole design from a picture" })).toBeVisible();
    await expect(panel).toContainText("a close reading of your picture");
    await expect(panel).toContainText("Nothing is kept until you accept it.");
    // What accepting really does, said before anyone accepts: the reading is kept, this design is
    // not changed, because putting an accepted reading onto a design is not built (decision 0038).
    await expect(panel).toContainText("It does not change this design");
    // And the reload rule: the panel does not look for a reading when it opens, and a second
    // reading of the same picture is a second vision call, so it says both before anyone starts.
    await expect(panel).toContainText("starts again from the picture");
    // Decision 0038 item 9: three words the screen never uses.
    await expect(panel).not.toContainText(/\b(exact|identical|matches your picture)\b/i);

    // A picture cannot be chosen until the person says they may use it (decision 0025's words).
    const file = panel.getByLabel("Choose a picture");
    await expect(file).toBeDisabled();
    await panel.getByRole("checkbox").check();
    await expect(file).toBeEnabled();

    await accessible(page, "[data-tool='garment']");
    await noSidewaysScroll(page);
  });

  test("works at phone width, where the tools are a bar along the bottom", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signedIn(page, "import-phone");
    await startDesign(page, "Import phone shirt");

    await openTool(page, "Garment");
    await expect(page.getByTestId("design-import")).toBeVisible();
    await noSidewaysScroll(page);
    await accessible(page, "[data-tool='garment']");
  });
});

/**
 * It was mounted in the design workspace's Logos tool first, and the browser tests said no: that
 * tool already carries the older per-design logo upload, so the screen offered two uploads and two
 * rights consents for the same crest (`e2e/flats.spec.ts` could no longer tell them apart, and
 * neither could a person). It is brand-scoped -- `/api/artwork` answers for the brand -- and every
 * picture picker on Brand Studio chooses from exactly these rows, so Brand Studio is its screen.
 */
test.describe("the brand's own artwork", () => {
  test("is a section of Brand Studio's Overview, with the upload and what it says about a file", async ({ page }) => {
    await signedIn(page, "artwork-door");
    await page.goto("/brand?tab=overview");

    const panel = page.getByRole("region", { name: "Your artwork" });
    await expect(panel.getByRole("heading", { name: "Your artwork" })).toBeVisible();
    await expect(panel).toContainText("how sharply it would print");
    await expect(panel).toContainText("belongs to the brand");
    // The upload itself, with its own rights tick and the formats it takes.
    await expect(panel.locator("input[type='file']")).toBeAttached();
    await expect(panel.getByRole("button", { name: "Add artwork" })).toBeVisible();
    // And one rights consent on the page, not two.
    expect(await page.getByLabel("I own this logo or have permission to use it on garments.").count()).toBe(1);

    await accessible(page);
    await noSidewaysScroll(page);
  });

  test("is where Brand Studio sends a brand that has no crest to choose", async ({ page }) => {
    await signedIn(page, "artwork-brand-studio");
    await page.goto("/brand?tab=logos");

    // The empty state offers the section that fills it, on this same page.
    await expect(page.getByText(/Add your logo to your artwork first/)).toBeVisible();
    await page.getByRole("link", { name: "Your artwork" }).click();
    await expect(page.getByRole("region", { name: "Your artwork" }).getByRole("button", { name: "Add artwork" })).toBeVisible();
  });

  test("leaves the design workspace's Logos tool with one upload, not two", async ({ page }) => {
    await signedIn(page, "artwork-one-upload");
    await startDesign(page, "One upload shirt");

    await openTool(page, "Logos");
    const logos = page.locator("[data-tool='logos']");
    expect(await logos.getByLabel("I own this logo or have permission to use it on garments.").count()).toBe(1);
    await expect(logos.getByRole("heading", { name: "Your artwork" })).toHaveCount(0);
  });
});

test.describe("every pattern we can draw", () => {
  test("is reached from the kit style link of the Colours tool, and says what each look can do", async ({ page }) => {
    await signedIn(page, "looks-door");
    await startDesign(page, "Looks shirt");

    await openTool(page, "Colours");
    await page.getByRole("link", { name: "Choose a kit style" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Choose a kit style" })).toBeVisible();

    const looks = page.getByTestId("pattern-looks");
    await expect(looks.getByRole("heading", { name: "Every pattern we can draw" })).toBeVisible();
    await expect(looks).toContainText("swatches for choosing a look");

    // A real picture for every style and preset, each with a plain label.
    const gallery = page.getByTestId("generator-gallery");
    await expect(gallery.getByRole("img").first()).toBeVisible();
    expect(await gallery.getByRole("img").count()).toBeGreaterThan(30);

    // And under them, what can be done with each: picked above, or not storable yet.
    await expect(looks).toContainText("Pick this one above");
    await expect(looks).toContainText("A design can only store the eight kit styles today");
    await expect(looks).toContainText("R-GAP-000");

    // The scan is over the gallery rather than the whole page: no spec scans this page whole, and a
    // new section should not stand or fall on everything the kit style gallery above it draws.
    await accessible(page, "[data-testid='pattern-looks']");
    await noSidewaysScroll(page);

    await page.setViewportSize(PHONE);
    await expect(looks.getByRole("heading", { name: "Every pattern we can draw" })).toBeVisible();
    await noSidewaysScroll(page);
    await accessible(page, "[data-testid='pattern-looks']");
  });
});

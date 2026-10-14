import { expect, type Page } from "@playwright/test";
import { createAccount, leaveWithoutChart, openTool, signIn, standInForBotCheck, test } from "./support";

/**
 * Plan step 8: the tech pack on screen. It is built from the one saved version of the design,
 * so it follows the editor. Nothing is invented: what nobody entered says "To be confirmed".
 */

/** Each section of the list at the side, and the headings of the document shown in it. */
const SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  ["Cover", ["Cover"]],
  ["Ready for the factory", ["Ready for the factory"]],
  ["Flats", ["Flats with callouts"]],
  ["Measurements", ["Measurement table"]],
  ["How to measure", ["How to measure"]],
  ["Pattern and cutting", ["Pattern and cutting"]],
  ["Construction", ["Construction"]],
  ["Order of work", ["Order of work"]],
  ["Bill of materials", ["Component list"]],
  ["Fabric", ["Fabric"]],
  ["Artwork", ["Artwork placement"]],
  ["Artwork and colour", ["Artwork and colour"]],
  ["Labelling", ["Labels and packing"]],
  ["Colourways", ["Colourways"]],
  ["Patterns", ["Patterns"]],
  ["Sources and notes", ["Suggested values", "Sign-off"]],
  ["Request a quote", ["Request a quote"]],
];

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/studio$/);
};

const startDesign = async (page: Page, type: string, name = "Tech pack test"): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: type });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

const saved = (page: Page, version: number) =>
  expect(page.getByTestId("save-status")).toHaveText(`Saved as version ${version}.`);

const openTechPack = async (page: Page): Promise<void> => {
  await page.getByRole("link", { name: "Tech pack" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\/tech-pack$/);
  await expect(page.getByRole("heading", { level: 2, name: "Cover" })).toBeVisible();
};

/** Shows one section of the factory file from the list at the side. */
const section = async (page: Page, label: string): Promise<void> => {
  const link = page.getByRole("navigation", { name: "Sections of the tech pack" }).getByRole("link", { name: new RegExp(`^${label} ?, `) });
  await link.click();
  await expect(link).toHaveAttribute("aria-current", "page");
};

/** Shows the list of what is left to fill in or make your own. */
const whatIsLeft = async (page: Page): Promise<void> => {
  await page.getByTestId("things-left").click();
  await expect(page.getByRole("heading", { level: 2, name: "What is left" })).toBeVisible();
};

test.describe("the tech pack page", () => {
  test("shows every section and a count of what is still to be confirmed, and links back to the design", async ({ page }) => {
    await signedIn(page, "pack-sections");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    for (const [label, headings] of SECTIONS) {
      await section(page, label);
      await expect(page).toHaveURL(/\?section=/);
      for (const heading of headings) {
        await expect(page.getByRole("heading", { level: 2, name: heading, exact: true })).toBeVisible();
      }
    }
    await expect(page.getByTestId("sign-off-statement")).toHaveText("Nobody has checked this specification yet.");
    // A new design has no pattern, fabric test or print files, so the list says what is missing and who acts.
    await section(page, "Ready for the factory");
    await expect(page.getByTestId("readiness-summary")).toHaveText(/^Not ready for the factory yet: \d+ things are left\.$/);
    await expect(page.locator('[data-item="pattern-present"]')).toContainText("A technician adds a pattern");
    await section(page, "Pattern and cutting");
    await expect(page.getByTestId("pattern-review")).toHaveText(/Draft pattern, not reviewed\./);
    await expect(page.getByTestId("things-left")).toHaveText(/^\d+ things left to fill in or make your own$/);

    await whatIsLeft(page);
    await expect(page.getByTestId("confirm-count")).toHaveText(/^\d+ things to confirm\.$/);
    // The measurements come from the Knitwright starter chart, so they are suggestions to confirm, not gaps.
    await expect(page.getByRole("link", { name: /^\d+ suggestions and \d+ proposals by Knitwright$/ })).toBeVisible();
    await expect(page.getByTestId("confirm-list").getByRole("link", { name: "Construction" })).toBeVisible();

    await page.getByTestId("confirm-list").getByRole("link", { name: "Construction" }).click();
    await expect(page).toHaveURL(/\?section=construction#construction$/);
    await expect(page.getByRole("heading", { level: 2, name: "Construction", exact: true })).toBeVisible();
    await expect(page.locator("#construction").getByText("To be confirmed").first()).toBeVisible();

    await page.getByRole("link", { name: "Back to the design" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tech pack test" })).toBeVisible();
  });

  test("shows every seam class as a proposal, and never says that nothing is left to confirm", async ({ page }) => {
    await signedIn(page, "pack-proposal");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    await section(page, "Construction");
    await expect(page.locator("tr[data-seam]").first()).toBeVisible();
    for (const row of await page.locator("tr[data-seam]").all()) {
      await expect(row).toContainText("Proposed by Knitwright. Not confirmed by anyone.");
    }
    await whatIsLeft(page);
    await expect(page.getByTestId("unconfirmed-counts")).toContainText("proposals by Knitwright");
    await section(page, "Sources and notes");
    await expect(page.locator("#suggested")).toContainText("Proposed by Knitwright");
    await expect(page.getByText("Nothing is left to confirm")).toHaveCount(0);
    await expect(page.locator('[class*="bg-ok"], [class*="text-ok"]')).toHaveCount(0);
  });

  test("opens the closed form when a link to what is left to confirm is followed", async ({ page }) => {
    await signedIn(page, "pack-open");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);
    await whatIsLeft(page);

    await page.getByTestId("confirm-list").getByRole("link", { name: "Component list" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Component list" })).toBeVisible();

    await expect(page.locator("#components details")).toHaveAttribute("open", "");
    await expect(page.locator("#components details").locator("input, select").first()).toBeFocused();
  });

  test("shows the drawings of a design with no size chart as not to scale, with no measurement values", async ({ page }) => {
    const email = await createAccount("pack-flats");
    await leaveWithoutChart(email, "crew-tee", "women");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);
    await section(page, "Flats");

    await expect(page.getByTestId("techpack-flat-front")).toBeVisible();
    await expect(page.getByTestId("techpack-flat-back")).toBeVisible();
    await expect(page.locator("#flats")).toContainText("Not to scale. Some measurements are missing.");
    const src = (await page.getByTestId("techpack-flat-front").getAttribute("src")) ?? "";
    expect(decodeURIComponent(src)).not.toMatch(/\d\.\d cm/);
  });

  test("finds a measurement typed in the editor in the table, marked as typed in by the user", async ({ page }) => {
    await signedIn(page, "pack-measure");
    await startDesign(page, "Crew neck tee");
    await openTool(page, "Sizes");
    const chest = page.getByLabel("Chest width in centimetres");
    await chest.fill("52.5");
    await chest.press("Enter");
    await saved(page, 2);

    await openTechPack(page);
    await section(page, "Measurements");

    const row = page.locator('tr[data-point="chest-width"]');
    await expect(row).toBeVisible();
    // The compact table is in centimetres, so each value is a bare number.
    await expect(row).toContainText("52.5");
    await expect(row).toContainText("Typed in by you");
    await expect(page.locator('tr[data-point="body-length"]')).toContainText("66.0");
    await expect(page.locator('tr[data-point="body-length"]')).not.toContainText("Typed in by you");
  });

  test("shows a fabric entered for the body in the component list, against the right panels", async ({ page }) => {
    await signedIn(page, "pack-fabric");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    await section(page, "Bill of materials");
    await page.getByText("Fill in fabrics and components").click();
    const form = page.getByRole("form", { name: "Add a fabric" });
    await form.getByLabel("Fabric name").fill("Body jersey");
    await form.getByLabel("Composition").fill("Cotton");
    await form.getByRole("button", { name: "Add fabric" }).click();
    await saved(page, 2);

    await expect(page.getByLabel("Fabric for Body front")).toContainText("Body jersey");
    await page.getByLabel("Fabric for Body front").selectOption({ label: "Body jersey" });
    await saved(page, 3);
    await page.getByLabel("Fabric for Body back").selectOption({ label: "Body jersey" });
    await saved(page, 4);

    const body = page.locator("tr[data-fabric]", { hasText: "Body jersey" });
    await expect(body).toContainText("Body front, Body back");
    await expect(body).toContainText("Cotton");
    await expect(body).toContainText("Typed in by you");
    const rest = page.locator("tr[data-fabric]", { hasText: "Main fabric" });
    await expect(rest).toContainText("Left sleeve, Right sleeve, Neckband");
    await expect(rest).not.toContainText("Body front");

    // The address keeps the section, so a reload shows the same one.
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Component list" })).toBeVisible();
    await expect(page.locator("tr[data-fabric]", { hasText: "Body jersey" })).toContainText("Body front, Body back");
  });

  test("keeps what is typed for a component, a seam and a label, and lowers the count", async ({ page }) => {
    await signedIn(page, "pack-details");
    await startDesign(page, "Polo shirt");
    await openTechPack(page);
    const count = async (): Promise<number> =>
      Number(((await page.getByTestId("confirm-count").textContent()) ?? "").split(" ")[0]);
    const before = await count();

    await section(page, "Bill of materials");
    await page.getByText("Fill in fabrics and components").click();
    const buttons = page.getByRole("form", { name: "Details for Buttons" });
    await buttons.getByLabel("Name of buttons").fill("Shell buttons");
    await buttons.getByLabel("Details of buttons").fill("Four hole, matched to the collar");
    await buttons.getByLabel("Quantity of buttons").fill("4 per garment");
    await buttons.getByRole("button", { name: "Save Buttons" }).click();
    await saved(page, 2);
    const row = page.locator('tr[data-component="buttons"]');
    await expect(row).toContainText("Shell buttons");
    await expect(row).toContainText("4 per garment");
    await expect(row).toContainText("Typed in by you");

    await section(page, "Construction");
    await page.getByText("Fill in the stitching").click();
    const hem = page.getByRole("form", { name: "Stitching for Body hem" });
    await hem.getByLabel("Stitch density of body hem").fill("Dense");
    await hem.getByLabel("Stitch class of body hem").selectOption({ label: "Lockstitch, ISO 301" });
    await hem.getByRole("button", { name: "Save Body hem" }).click();
    await saved(page, 3);
    const seam = page.locator('tr[data-seam="body-hem"]');
    await expect(seam).toContainText("Lockstitch");
    await expect(seam).toContainText("ISO 301");
    await expect(seam).toContainText("Dense");
    await expect(page.locator('tr[data-seam="shoulder-seam"]')).toContainText("Proposed by Knitwright. Not confirmed by anyone.");

    await section(page, "Labelling");
    await page.getByText("Fill in labels and packing").click();
    const origin = page.getByRole("form", { name: "Country of origin" });
    await origin.getByLabel("Country of origin").fill("Portugal");
    await origin.getByRole("button", { name: "Save country of origin" }).click();
    await saved(page, 4);
    await expect(page.locator("#labelling")).toContainText("Portugal");

    await expect.poll(count).toBeLessThan(before);
  });

  test("shows one section at a time, and the address and the back button return to it", async ({ page }) => {
    await signedIn(page, "pack-tabs");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);
    await expect(page.getByRole("heading", { level: 2, name: "Measurement table" })).toBeHidden();

    await section(page, "Measurements");
    await expect(page).toHaveURL(/\?section=measurements$/);
    await expect(page.getByRole("heading", { level: 2, name: "Cover", exact: true })).toBeHidden();
    await section(page, "Construction");
    await page.goBack();
    await expect(page).toHaveURL(/\?section=measurements$/);
    await expect(page.getByRole("heading", { level: 2, name: "Measurement table" })).toBeVisible();

    await page.goto(`${new URL(page.url()).pathname}?section=no-such-section`);
    await expect(page.getByRole("heading", { level: 2, name: "Cover", exact: true })).toBeVisible();
  });

  test("accepts every suggestion in one version, after saying how many values it sets", async ({ page }) => {
    await signedIn(page, "pack-accept");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);
    const left = async (): Promise<number> => Number(((await page.getByTestId("things-left").textContent()) ?? "").split(" ")[0]);
    const before = await left();

    await page.getByTestId("accept-all").click();
    await expect(page.getByText(/^Make all \d+ suggested values your own\? They are saved together as one new version/)).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.getByTestId("accept-all")).toBeVisible();

    await page.getByTestId("accept-all").click();
    await page.getByTestId("accept-all-yes").click();
    await saved(page, 2);

    await expect.poll(left).toBeLessThan(before);
    await expect(page.getByTestId("accept-all")).toHaveCount(0);
    await section(page, "Measurements");
    await expect(page.locator('tr[data-point="chest-width"]')).toContainText("Typed in by you");
    await expect(page.getByTestId("confirm-panel-measurements")).toHaveCount(0);
  });

  test("fits a phone: the sections are a list of choices, and the page never scrolls sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page, "pack-phone");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    await page.getByLabel("Section", { exact: true }).selectOption("measurements");
    await expect(page.getByRole("heading", { level: 2, name: "Measurement table" })).toBeVisible();
    await expect(page).toHaveURL(/\?section=measurements$/);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });

  test("answers within two seconds", async ({ page }) => {
    // The waits in these tests allow 10 seconds each, so a page that slowed down would still
    // pass them. This holds the page's own time to the budget: the server's whole answer.
    const BUDGET_MS = 2_000;
    await signedIn(page, "pack-speed");
    await startDesign(page, "Crew neck tee");
    const address = `${new URL(page.url()).pathname}/tech-pack`;

    for (let visit = 0; visit < 3; visit += 1) {
      const response = await page.goto(address);
      expect(response?.status()).toBe(200);
      await response?.finished();
      const answeredIn = response?.request().timing().responseEnd ?? Number.POSITIVE_INFINITY;
      expect(answeredIn).toBeLessThan(BUDGET_MS);
    }
  });

  test("refuses a fabric weight that is not a number, beside the field", async ({ page }) => {
    await signedIn(page, "pack-weight");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    await section(page, "Bill of materials");
    await page.getByText("Fill in fabrics and components").click();
    const form = page.getByRole("form", { name: "Add a fabric" });
    await form.getByLabel("Fabric name").fill("Mesh");
    await form.getByLabel("Weight (grams per square metre)").fill("heavy");
    await form.getByRole("button", { name: "Add fabric" }).click();

    await expect(
      form.getByText("Enter the weight as a whole number of grams per square metre, such as 180."),
    ).toBeVisible();
  });
});

test.describe("isolation between brands", () => {
  test("a member of another brand gets not found for the tech pack address", async ({ page, browser }) => {
    await signedIn(page, "pack-owner");
    await startDesign(page, "Crew neck tee", "Private shirt");
    await openTechPack(page);
    const path = new URL(page.url()).pathname;

    const other = await browser.newContext({
      extraHTTPHeaders: { "x-real-ip": `10.97.${Math.floor(Math.random() * 250)}.9` },
    });
    await standInForBotCheck(other);
    try {
      const stranger = await other.newPage();
      await signIn(stranger, await createAccount("pack-stranger"));
      await expect(stranger).toHaveURL(/\/studio$/);

      const response = await stranger.goto(path);

      expect(response?.status()).toBe(404);
      await expect(stranger.getByText("Private shirt")).toHaveCount(0);
    } finally {
      await other.close();
    }
  });

  test("a visitor with no session is sent to sign in", async ({ page }) => {
    await page.goto("/studio/3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11/tech-pack");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});


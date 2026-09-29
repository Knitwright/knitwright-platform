import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * Plan step 8: the tech pack on screen. It is built from the one saved version of the design,
 * so it follows the editor. Nothing is invented: what nobody entered says "To be confirmed".
 */

const HEADINGS = [
  "Cover",
  "Flats with callouts",
  "Measurement table",
  "How to measure",
  "Component list",
  "Construction",
  "Colourways",
  "Artwork placement",
  "Labels and packing",
  "Suggested values",
  "Sign-off",
] as const;

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

test.describe("the tech pack page", () => {
  test("shows every section and a count of what is still to be confirmed, and links back to the design", async ({ page }) => {
    await signedIn(page, "pack-sections");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    for (const heading of HEADINGS) {
      await expect(page.getByRole("heading", { level: 2, name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("confirm-count")).toHaveText(/^\d+ things to confirm\.$/);
    await expect(page.getByTestId("confirm-list").getByRole("link", { name: "Measurement table" })).toBeVisible();
    await expect(page.getByTestId("sign-off-statement")).toHaveText("Nobody has checked this specification yet.");
    await expect(page.getByText("To be confirmed").first()).toBeVisible();

    await page.getByTestId("confirm-list").getByRole("link", { name: "Measurement table" }).click();
    await expect(page).toHaveURL(/#measurements$/);

    await page.getByRole("link", { name: "Back to the design" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tech pack test" })).toBeVisible();
  });

  test("shows every seam class as a proposal, and never says that nothing is left to confirm", async ({ page }) => {
    await signedIn(page, "pack-proposal");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    for (const row of await page.locator("tr[data-seam]").all()) {
      await expect(row).toContainText("Proposed by Knitwright. Not confirmed by anyone.");
    }
    await expect(page.getByTestId("unconfirmed-counts")).toContainText("proposals by Knitwright");
    await expect(page.locator("#suggested")).toContainText("Proposed by Knitwright");
    await expect(page.getByText("Nothing is left to confirm")).toHaveCount(0);
    await expect(page.locator('[class*="bg-ok"], [class*="text-ok"]')).toHaveCount(0);
  });

  test("opens the closed form when a link to what is left to confirm is followed", async ({ page }) => {
    await signedIn(page, "pack-open");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    await page.getByTestId("confirm-list").getByRole("link", { name: "Component list" }).click();

    await expect(page.locator("#components details")).toHaveAttribute("open", "");
    await expect(page.locator("#components details").locator("input, select").first()).toBeFocused();
  });

  test("shows the drawings of a new design as not to scale, with no measurement values", async ({ page }) => {
    await signedIn(page, "pack-flats");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

    await expect(page.getByTestId("techpack-flat-front")).toBeVisible();
    await expect(page.getByTestId("techpack-flat-back")).toBeVisible();
    await expect(page.locator("#flats")).toContainText("Not to scale. Some measurements are missing.");
    const src = (await page.getByTestId("techpack-flat-front").getAttribute("src")) ?? "";
    expect(decodeURIComponent(src)).not.toMatch(/\d\.\d cm/);
  });

  test("finds a measurement typed in the editor in the table, marked as typed in by the user", async ({ page }) => {
    await signedIn(page, "pack-measure");
    await startDesign(page, "Crew neck tee");
    const chest = page.getByLabel("Chest width in centimetres");
    await chest.fill("52.5");
    await chest.press("Enter");
    await saved(page, 2);

    await openTechPack(page);

    const row = page.locator('tr[data-point="chest-width"]');
    await expect(row).toContainText("52.5 cm");
    await expect(row).toContainText("Typed in by you");
    await expect(page.locator('tr[data-point="body-length"]')).toContainText("To be confirmed");
    await expect(page.locator('tr[data-point="body-length"]')).not.toContainText("Typed in by you");
  });

  test("shows a fabric entered for the body in the component list, against the right panels", async ({ page }) => {
    await signedIn(page, "pack-fabric");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

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

    await page.reload();
    await expect(page.locator("tr[data-fabric]", { hasText: "Body jersey" })).toContainText("Body front, Body back");
  });

  test("keeps what is typed for a component, a seam and a label, and lowers the count", async ({ page }) => {
    await signedIn(page, "pack-details");
    await startDesign(page, "Polo shirt");
    await openTechPack(page);
    const count = async (): Promise<number> =>
      Number(((await page.getByTestId("confirm-count").textContent()) ?? "").split(" ")[0]);
    const before = await count();

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

    await page.getByText("Fill in labels and packing").click();
    const origin = page.getByRole("form", { name: "Country of origin" });
    await origin.getByLabel("Country of origin").fill("Portugal");
    await origin.getByRole("button", { name: "Save country of origin" }).click();
    await saved(page, 4);
    await expect(page.locator("#labelling")).toContainText("Portugal");

    await expect.poll(count).toBeLessThan(before);
  });

  test("refuses a fabric weight that is not a number, beside the field", async ({ page }) => {
    await signedIn(page, "pack-weight");
    await startDesign(page, "Crew neck tee");
    await openTechPack(page);

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


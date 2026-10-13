import { expect, type Locator, type Page } from "@playwright/test";
import { createAccount, signIn, standInForBotCheck, test } from "./support";

/** Plan step 6: the editor. Sign in, make a design, change it, reload, find it saved. */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/studio$/);
};

const startDesign = async (page: Page, type: string, name = "Home shirt"): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: type });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname;
};

const choice = (page: Page, option: string, label: RegExp): Locator =>
  page.getByRole("group", { name: option }).getByRole("radio", { name: label });

const chest = (page: Page): Locator => page.getByLabel("Chest width in centimetres");

const saved = (page: Page, version: number) => expect(page.getByTestId("save-status")).toHaveText(`Saved as version ${version}.`);

test.describe("the design list", () => {
  test("invites the first design, then lists it with its details", async ({ page }) => {
    await signedIn(page, "list");
    await expect(page.getByRole("heading", { name: "Start your first design" })).toBeVisible();

    await page.getByRole("link", { name: "Blank design" }).click();
    await expect(page).toHaveURL(/\/studio\/new$/);
    await page.getByLabel("Garment type").selectOption({ label: "Polo shirt" });
    await page.getByLabel("Made for").selectOption({ label: "Men" });
    await page.getByLabel("Design name").fill("Club polo");
    await page.getByLabel("Style number (optional)").fill("CP-7");
    await page.getByLabel("Season (optional)").fill("SS27");
    await page.getByRole("button", { name: "Create design" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Club polo" })).toBeVisible();

    await page.goto("/studio");

    const row = page.getByRole("listitem").filter({ hasText: "Club polo" });
    await expect(row).toContainText("Polo shirt");
    await expect(row).toContainText("CP-7");
    await expect(row).toContainText("SS27");
    await expect(page.getByRole("heading", { name: "Start your first design" })).toHaveCount(0);
  });

  test("a new design form that is left empty names the fields that need another look", async ({ page }) => {
    await signedIn(page, "new-empty");
    await page.goto("/studio/new");

    await page.getByRole("button", { name: "Create design" }).click();

    await expect(page.getByText("Choose a garment type.")).toBeVisible();
    await expect(page.getByText("Choose who it is for.")).toBeVisible();
    await expect(page.getByText("A design name has 1 to 80 characters.")).toBeVisible();
    await expect(page.getByLabel("Garment type")).toBeFocused();
  });
});

test.describe("the editor", () => {
  test("keeps two option changes and a measurement after a reload", async ({ page }) => {
    await signedIn(page, "acceptance");
    await startDesign(page, "Crew neck tee");
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await choice(page, "Fit", /^Slim/).check();
    await saved(page, 2);
    await choice(page, "Hem shape", /^Curved/).check();
    await saved(page, 3);
    await chest(page).fill("52.5");
    await chest(page).press("Enter");
    await saved(page, 4);

    await page.reload();

    await expect(page.getByTestId("version")).toHaveText("Version 4");
    await expect(choice(page, "Fit", /^Slim/)).toBeChecked();
    await expect(choice(page, "Hem shape", /^Curved/)).toBeChecked();
    await expect(chest(page)).toHaveValue("52.5");
    const row = page.getByRole("row", { name: /Chest width/ });
    await expect(row).toContainText("Typed in by you");
    await expect(page.getByText("Chest width set to 52.5 cm.")).toBeVisible();
  });

  test("starts a new design with the Knitwright starter chart, shown as suggestions to check with the factory", async ({ page }) => {
    await signedIn(page, "missing");
    await startDesign(page, "Crew neck tee");

    await expect(chest(page)).toHaveValue("51");
    const row = page.getByRole("row", { name: /Chest width/ });
    await expect(row).toContainText("Suggested from a size chart");
    await expect(row).toContainText("±1 cm");
    await expect(page.getByText("These measurements are suggestions from the Knitwright starter chart")).toBeVisible();
  });

  test("undo puts the measurement back", async ({ page }) => {
    await signedIn(page, "undo");
    await startDesign(page, "Crew neck tee");
    await chest(page).fill("48");
    await chest(page).press("Enter");
    await saved(page, 2);
    await expect(chest(page)).toHaveValue("48");

    await page.getByRole("button", { name: "Undo" }).click();

    await saved(page, 3);
    await expect(chest(page)).toHaveValue("51");
    await expect(page.getByText("Restored version 1.")).toBeVisible();
    await expect(page.getByText("Chest width set to 48 cm.")).toBeVisible();
  });

  test("restores any earlier version as a new one", async ({ page }) => {
    await signedIn(page, "restore");
    await startDesign(page, "Crew neck tee");
    await choice(page, "Fit", /^Slim/).check();
    await saved(page, 2);
    await choice(page, "Fit", /^Relaxed/).check();
    await saved(page, 3);

    // Two quick edits by one person are one entry in the history, with each version inside it.
    await page.getByText("Show each change").click();
    await page.getByRole("button", { name: "Restore version 2" }).click();

    await saved(page, 4);
    await expect(choice(page, "Fit", /^Slim/)).toBeChecked();
    await expect(page.getByRole("button", { name: "Restore version 3" })).toBeVisible();
  });

  test("shows a choice that would break a rule as disabled, with the reason", async ({ page }) => {
    await signedIn(page, "rules");
    await startDesign(page, "Team jersey");

    await choice(page, "Collar", /^Band collar/).check();
    await saved(page, 2);

    const vNeck = choice(page, "Neckline", /^V neck/);
    await expect(vNeck).toBeDisabled();
    await expect(page.getByText(/Not available\. A band collar stands up all the way round/)).toBeVisible();
    await expect(choice(page, "Neckline", /^Round neck/)).toBeEnabled();
  });

  test("lets the keyboard reach an unavailable choice, so its reason is heard, but not pick it", async ({ page }) => {
    await signedIn(page, "keyboard-reason");
    await startDesign(page, "Team jersey");
    await choice(page, "Collar", /^Band collar/).check();
    await saved(page, 2);

    const vNeck = choice(page, "Neckline", /^V neck/);
    await vNeck.focus();

    await expect(vNeck).toBeFocused();
    await expect(vNeck).toHaveAttribute("aria-disabled", "true");
    await expect(vNeck).toHaveAccessibleDescription(/Not available\. A band collar stands up/);
    await vNeck.click({ force: true });
    await expect(vNeck).not.toBeChecked();
    await expect(page.getByTestId("version")).toHaveText("Version 2");
  });

  test("sends only the choice the person settles on when arrow keys step through a group", async ({ page }) => {
    await signedIn(page, "arrows");
    await startDesign(page, "Crew neck tee");

    await choice(page, "Fit", /^Regular/).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");

    await saved(page, 2);
    await expect(choice(page, "Fit", /^Relaxed/)).toBeChecked();
    await page.waitForTimeout(700);
    await expect(page.getByTestId("version")).toHaveText("Version 2");
    await expect(page.getByText("Fit changed to Slim.")).toHaveCount(0);
  });

  test("lists every garment type that is offered, under the name of its family", async ({ page }) => {
    await signedIn(page, "groups");
    await page.goto("/studio/new");

    await expect(page.locator('optgroup[label="Tops"] option')).toHaveCount(5);
    // Leggings, sports bras and compression tops wait for the second wave (decision 0027).
    await expect(page.locator("option", { hasText: "Leggings" })).toHaveCount(0);
    await expect(page.locator("option", { hasText: "Sports bra" })).toHaveCount(0);
  });

  test("adds player names and numbers, with a height left to be confirmed", async ({ page }) => {
    await signedIn(page, "marks");
    const address = await startDesign(page, "Team jersey");
    const marks = page.getByTestId("names-numbers");
    await marks.getByLabel("Sample name").fill("SMITH");
    await marks.getByLabel("Lettering style").selectOption({ label: "Block" });
    await marks.getByRole("button", { name: "Add names and numbers" }).click();
    await saved(page, 2);
    await expect(page.getByTestId("garment-3d-toggle")).toHaveCount(0);

    await page.goto(`${address}/tech-pack`);
    const table = page.getByTestId("player-marks");
    await expect(table).toContainText("Name across the upper back");
    await expect(table).toContainText("Name, sample SMITH");
    await expect(table).toContainText("To be confirmed");
  });

  test("says what a change removed", async ({ page }) => {
    await signedIn(page, "dropped");
    await startDesign(page, "Team jersey");
    await page.getByLabel("Shoulder width in centimetres").fill("40");
    await page.getByLabel("Shoulder width in centimetres").press("Enter");
    await saved(page, 2);

    await choice(page, "Sleeve type", /^Raglan/).check();
    await saved(page, 3);

    const notice = page.getByRole("status").filter({ hasText: "This change removed or reset some things." });
    await expect(notice).toContainText("Shoulder width");
    await expect(page.getByLabel("Shoulder width in centimetres")).toHaveCount(0);
  });

  test("sets the size run, and refuses one that is not complete beside the field", async ({ page }) => {
    await signedIn(page, "sizes");
    await startDesign(page, "Crew neck tee");

    await page.getByLabel("Sizes, smallest first").fill("S, M, L");
    await page.getByRole("button", { name: "Save sizes" }).click();
    await expect(page.getByText("Choose the base size.")).toBeVisible();
    await expect(page.getByLabel("Base size")).toBeFocused();

    await page.getByLabel("Base size").selectOption("M");
    await page.getByRole("button", { name: "Save sizes" }).click();
    await saved(page, 2);

    await page.reload();
    await expect(page.getByLabel("Sizes, smallest first")).toHaveValue("S, M, L");
    await expect(page.getByLabel("Base size")).toHaveValue("M");
    await expect(page.getByRole("heading", { name: "Measurements for size M" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change sizes" })).toBeVisible();
  });

  test("refuses a measurement that is not a length, beside the field", async ({ page }) => {
    await signedIn(page, "bad-length");
    await startDesign(page, "Crew neck tee");

    await chest(page).fill("wide");
    await chest(page).press("Enter");

    await expect(page.getByText("Enter a length in centimetres, such as 52.5.")).toBeVisible();
    await expect(chest(page)).toBeFocused();
    await expect(chest(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("version")).toHaveText("Version 1");
  });

  test("changes the name, style number and season without adding a version", async ({ page }) => {
    await signedIn(page, "rename");
    await startDesign(page, "Crew neck tee");

    await page.getByLabel("Design name").fill("Away shirt");
    await page.getByLabel("Style number (optional)").fill("AS-2");
    await page.getByRole("button", { name: "Save details" }).click();

    await expect(page.getByText("The details are saved.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Away shirt" })).toBeVisible();
    await page.getByLabel("Season (optional)").fill("AW27");
    await expect(page.getByText("The details are saved.")).toHaveCount(0);
    await expect(page.getByTestId("version")).toHaveText("Version 1");
  });

  test("tells the person when the design was changed somewhere else, and reloads on request", async ({ page, context }) => {
    await signedIn(page, "conflict");
    const path = await startDesign(page, "Crew neck tee");
    const other = await context.newPage();
    await other.goto(path);

    await choice(other, "Fit", /^Slim/).check();
    await saved(other, 2);
    await choice(page, "Hem shape", /^Curved/).check();

    const alert = page.getByRole("alert").filter({ hasText: "This design was changed somewhere else. Reload to see the latest version." });
    await expect(alert).toBeVisible();
    // The choice that was not saved is not shown as if it were.
    await expect(choice(page, "Hem shape", /^Curved/)).not.toBeChecked();
    await expect(choice(page, "Hem shape", /^Straight across/)).toBeChecked();
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await alert.getByRole("button", { name: "Reload" }).click();

    await expect(page.getByTestId("version")).toHaveText("Version 2");
    await expect(alert).toHaveCount(0);
    await expect(choice(page, "Fit", /^Slim/)).toBeChecked();
    await expect(choice(page, "Hem shape", /^Curved/)).not.toBeChecked();
    await expect(choice(page, "Hem shape", /^Straight across/)).toBeChecked();
  });

  test("goes back through three undos in a row, then offers no more", async ({ page }) => {
    await signedIn(page, "undo-chain");
    await startDesign(page, "Crew neck tee");
    await choice(page, "Fit", /^Slim/).check();
    await saved(page, 2);
    await choice(page, "Hem shape", /^Curved/).check();
    await saved(page, 3);
    const undo = page.getByRole("button", { name: "Undo" });

    await undo.click();
    await saved(page, 4);
    await expect(choice(page, "Fit", /^Slim/)).toBeChecked();
    await expect(choice(page, "Hem shape", /^Straight across/)).toBeChecked();

    await undo.click();
    await saved(page, 5);
    await expect(choice(page, "Fit", /^Regular/)).toBeChecked();

    await expect(undo).toBeDisabled();
  });

  test("clears a value of your own when its field is emptied", async ({ page }) => {
    await signedIn(page, "clear");
    await startDesign(page, "Crew neck tee");
    await chest(page).fill("52,5");
    await chest(page).press("Enter");
    await saved(page, 2);
    await expect(chest(page)).toHaveValue("52.5");

    await chest(page).fill("");
    await chest(page).press("Enter");

    await saved(page, 3);
    await expect(chest(page)).toHaveValue("51");
    await expect(page.getByText("Your value for Chest width was removed.")).toBeVisible();
  });

  test("saves nothing when the text means the value that is already held", async ({ page }) => {
    await signedIn(page, "same-value");
    await startDesign(page, "Crew neck tee");
    await chest(page).fill("52.5");
    await chest(page).press("Enter");
    await saved(page, 2);

    await chest(page).fill(" 52,50 ");
    await chest(page).press("Enter");
    await page.waitForTimeout(500);

    await expect(page.getByTestId("version")).toHaveText("Version 2");
    await expect(chest(page)).toHaveValue(" 52,50 ");
  });

  test("marks a mistake found when the person leaves the field, without taking focus", async ({ page }) => {
    await signedIn(page, "blur");
    await startDesign(page, "Crew neck tee");

    await chest(page).fill("wide");
    const other = page.getByLabel("Body length in centimetres");
    await other.click();

    await expect(page.getByText("Enter a length in centimetres, such as 52.5.")).toBeVisible();
    await expect(chest(page)).toHaveAttribute("aria-invalid", "true");
    await expect(other).toBeFocused();
  });

  test("warns before the page is left while text has not been saved", async ({ page }) => {
    await signedIn(page, "leave");
    await startDesign(page, "Crew neck tee");
    await chest(page).click();
    await page.keyboard.type("47");
    let warned = false;
    page.on("dialog", async (dialog) => {
      warned = dialog.type() === "beforeunload";
      await dialog.dismiss();
    });

    await page.close({ runBeforeUnload: true });

    await expect.poll(() => warned).toBe(true);
  });
});

test.describe("isolation between brands", () => {
  test("a member of another brand gets not found for the design's address", async ({ page, browser }) => {
    await signedIn(page, "owner");
    const path = await startDesign(page, "Crew neck tee");

    const other = await browser.newContext({
      extraHTTPHeaders: { "x-real-ip": `10.98.${Math.floor(Math.random() * 250)}.7` },
    });
    await standInForBotCheck(other);
    try {
      const stranger = await other.newPage();
      await signIn(stranger, await createAccount("stranger"));
      await expect(stranger).toHaveURL(/\/studio$/);

      const response = await stranger.goto(path);

      expect(response?.status()).toBe(404);
      await expect(stranger.getByRole("heading", { name: "Page not found" })).toBeVisible();
      await expect(stranger.getByText("Home shirt")).toHaveCount(0);

      await stranger.goto("/studio");
      await expect(stranger.getByText("Home shirt")).toHaveCount(0);
    } finally {
      await other.close();
    }
  });

  test("an address that is not an id is also not found", async ({ page }) => {
    await signedIn(page, "no-id");

    const response = await page.goto("/studio/not-an-id");

    expect(response?.status()).toBe(404);
  });
});

import { expect, type Locator, type Page } from "@playwright/test";
import { createAccount, createColleagueOf, openTool, signIn, standInForBotCheck, test } from "./support";

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

    const row = page.getByRole("list", { name: /^Designs of / }).getByRole("listitem").filter({ hasText: "Club polo" });
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
    await openTool(page, "Sizes");
    await chest(page).fill("52.5");
    await chest(page).press("Enter");
    await saved(page, 4);

    // The address keeps the open tool, so the reload opens the same panel.
    await page.reload();

    await expect(page).toHaveURL(/\?tool=sizes$/);
    await expect(page.getByRole("tab", { name: "Sizes", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("version")).toHaveText("Version 4");
    await expect(chest(page)).toHaveValue("52.5");
    const row = page.getByRole("row", { name: /Chest width/ });
    await expect(row).toContainText("Typed in by you");
    await openTool(page, "Garment");
    await expect(choice(page, "Fit", /^Slim/)).toBeChecked();
    await expect(choice(page, "Hem shape", /^Curved/)).toBeChecked();
    // Three quick edits by one person are one entry in the history, named by the last of them.
    await openTool(page, "History");
    await expect(page.getByText("3 changes in a row. The last: Chest width set to 52.5 cm.")).toBeVisible();
    await page.getByText("Show each change").click();
    await expect(page.getByText("Chest width set to 52.5 cm.", { exact: true })).toBeVisible();
  });

  test("starts a new design with the Knitwright starter chart, shown as suggestions to check with the factory", async ({ page }) => {
    await signedIn(page, "missing");
    await startDesign(page, "Crew neck tee");
    await openTool(page, "Sizes");

    await expect(chest(page)).toHaveValue("51");
    const row = page.getByRole("row", { name: /Chest width/ });
    await expect(row).toContainText("Suggested from a size chart");
    await expect(row).toContainText("±1 cm");
    await expect(page.getByText("These measurements are suggestions from the Knitwright starter chart")).toBeVisible();
  });

  test("undo puts the measurement back", async ({ page }) => {
    await signedIn(page, "undo");
    await startDesign(page, "Crew neck tee");
    await openTool(page, "Sizes");
    await chest(page).fill("48");
    await chest(page).press("Enter");
    await saved(page, 2);
    await expect(chest(page)).toHaveValue("48");

    await page.getByRole("button", { name: "Undo" }).click();

    await saved(page, 3);
    await expect(chest(page)).toHaveValue("51");
    await openTool(page, "History");
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
    await openTool(page, "History");
    await page.getByText("Show each change").click();
    await page.getByRole("button", { name: "Restore version 2" }).click();

    await saved(page, 4);
    await expect(page.getByRole("button", { name: "Restore version 3" })).toBeVisible();
    await openTool(page, "Garment");
    await expect(choice(page, "Fit", /^Slim/)).toBeChecked();
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
    await openTool(page, "Names");
    const marks = page.getByTestId("names-numbers");
    await marks.getByLabel("Sample name").fill("SMITH");
    await marks.getByLabel("Lettering style").selectOption({ label: "Block" });
    await marks.getByRole("button", { name: "Add names and numbers" }).click();
    await saved(page, 2);
    await expect(page.getByTestId("garment-3d-toggle")).toHaveCount(0);

    await page.goto(`${address}/tech-pack?section=artwork`);
    const table = page.getByTestId("player-marks");
    await expect(table).toContainText("Name across the upper back");
    await expect(table).toContainText("Name, sample SMITH");
    await expect(table).toContainText("To be confirmed");
  });

  test("says what a change removed", async ({ page }) => {
    await signedIn(page, "dropped");
    await startDesign(page, "Team jersey");
    // The starter chart suggests 40 cm, so a different value is typed to make it the person's own.
    await openTool(page, "Sizes");
    await page.getByLabel("Shoulder width in centimetres").fill("41");
    await page.getByLabel("Shoulder width in centimetres").press("Enter");
    await saved(page, 2);

    await openTool(page, "Garment");
    await choice(page, "Sleeve type", /^Raglan/).check();
    await saved(page, 3);

    const notice = page.getByRole("status").filter({ hasText: "This change removed or reset some things." });
    await expect(notice).toContainText("Shoulder width");
    await expect(page.getByLabel("Shoulder width in centimetres")).toHaveCount(0);
  });

  test("changes the size run, and refuses one that is not complete beside the field", async ({ page }) => {
    await signedIn(page, "sizes");
    await startDesign(page, "Crew neck tee");
    await openTool(page, "Sizes");
    // A new design starts with the size run of the Knitwright starter chart.
    await expect(page.getByLabel("Sizes, smallest first")).toHaveValue("XS, S, M, L, XL, 2XL");
    await expect(page.getByLabel("Base size")).toHaveValue("M");

    // The base size M is not in the new run, so it is refused and a base size has to be chosen again.
    await page.getByLabel("Sizes, smallest first").fill("S, L, XL");
    await page.getByRole("button", { name: "Change sizes" }).click();
    await expect(page.getByText("The base size must be one of the sizes.")).toBeVisible();
    await expect(page.getByLabel("Base size")).toBeFocused();
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await page.getByLabel("Base size").selectOption("L");
    await page.getByRole("button", { name: "Change sizes" }).click();
    await saved(page, 2);

    await page.reload();
    await expect(page.getByLabel("Sizes, smallest first")).toHaveValue("S, L, XL");
    await expect(page.getByLabel("Base size")).toHaveValue("L");
    await expect(page.getByRole("heading", { name: "Measurements for size L" })).toBeVisible();
  });

  test("refuses a measurement that is not a length, beside the field", async ({ page }) => {
    await signedIn(page, "bad-length");
    await startDesign(page, "Crew neck tee");
    await openTool(page, "Sizes");

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

  test("tells the person when someone else changed the design, and reloads on request", async ({ page, browser }) => {
    const email = await createAccount("conflict");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    const path = await startDesign(page, "Crew neck tee");

    // A colleague in the same brand saves a change from their own browser. A save by the
    // person themselves in another tab is not a conflict: their change is sent again on top of it.
    const elsewhere = await browser.newContext({
      extraHTTPHeaders: { "x-real-ip": `10.97.${Math.floor(Math.random() * 250)}.7` },
    });
    await standInForBotCheck(elsewhere);
    try {
      const other = await elsewhere.newPage();
      await signIn(other, await createColleagueOf(email, "conflict-colleague"));
      await expect(other).toHaveURL(/\/studio$/);
      await other.goto(path);
      await choice(other, "Fit", /^Slim/).check();
      await saved(other, 2);
    } finally {
      await elsewhere.close();
    }
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

  test("saves a change on top of one the same person saved in another tab", async ({ page, context }) => {
    await signedIn(page, "own-tab");
    const path = await startDesign(page, "Crew neck tee");
    const other = await context.newPage();
    await other.goto(path);

    await choice(other, "Fit", /^Slim/).check();
    await saved(other, 2);
    await choice(page, "Hem shape", /^Curved/).check();

    await saved(page, 3);
    await expect(page.getByRole("alert").filter({ hasText: "This design was changed somewhere else." })).toHaveCount(0);
    await page.reload();
    await expect(choice(page, "Fit", /^Slim/)).toBeChecked();
    await expect(choice(page, "Hem shape", /^Curved/)).toBeChecked();
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
    await openTool(page, "Sizes");
    await chest(page).fill("52,5");
    await chest(page).press("Enter");
    await saved(page, 2);
    await expect(chest(page)).toHaveValue("52.5");

    await chest(page).fill("");
    await chest(page).press("Enter");

    await saved(page, 3);
    await expect(chest(page)).toHaveValue("51");
    await openTool(page, "History");
    // Both quick edits are one entry in the history, named by the last of them.
    await expect(page.getByText("2 changes in a row. The last: Your value for Chest width was removed.")).toBeVisible();
  });

  test("saves nothing when the text means the value that is already held", async ({ page }) => {
    await signedIn(page, "same-value");
    await startDesign(page, "Crew neck tee");
    await openTool(page, "Sizes");
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
    await openTool(page, "Sizes");

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
    await openTool(page, "Sizes");
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

test.describe("the one-screen workspace", () => {
  test("moves between tools with the arrow keys, keeps the open tool in the address, and lets Tab reach the panel", async ({ page }) => {
    await signedIn(page, "workspace-keys");
    await startDesign(page, "Crew neck tee");
    const tools = page.getByRole("tablist", { name: "Tools" });
    await expect(tools.getByRole("tab")).toHaveText(["Garment", "Colours", "Sizes", "Fabric", "Logos", "Names", "Labels", "Ideas", "Comments", "Media", "History"]);

    await tools.getByRole("tab", { name: "Garment" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(tools.getByRole("tab", { name: "Colours" })).toBeFocused();
    await expect(tools.getByRole("tab", { name: "Colours" })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\?tool=colours$/);
    await page.keyboard.press("End");
    await expect(tools.getByRole("tab", { name: "History" })).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    await expect(tools.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("tabpanel", { name: "History" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 2, name: "History" })).toBeVisible();
    await expect(page.getByLabel("Chest width in centimetres")).toBeHidden();

    // The whole workspace fits the screen: only the panels scroll.
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("opens the panel a link names, and collapses the assistant", async ({ page }) => {
    await signedIn(page, "workspace-link");
    const path = await startDesign(page, "Crew neck tee");

    await page.goto(`${path}?tool=logos`);
    await expect(page.getByRole("tab", { name: "Logos", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Logo or picture")).toBeVisible();
    await page.goto(`${path}#share-heading`);
    await expect(page).toHaveURL(/\?tool=share#share-heading$/);
    await expect(page.getByRole("heading", { name: "Share with your committee" })).toBeVisible();

    const assistant = page.getByRole("complementary", { name: "Design assistant" });
    await expect(assistant.getByLabel("Describe a change")).toBeVisible();
    await assistant.getByRole("button", { name: "Hide" }).click();
    await expect(assistant).toBeHidden();
    await page.getByRole("button", { name: "Show assistant" }).click();
    await expect(assistant.getByLabel("Describe a change")).toBeVisible();
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("puts the drawing first, the tools in a bar along the bottom and the assistant in a sheet, with nothing off the side", async ({ page }) => {
      await signedIn(page, "workspace-phone");
      await startDesign(page, "Crew neck tee");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

      const bar = page.getByRole("navigation", { name: "Design tools" });
      const box = await bar.boundingBox();
      expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
      await bar.getByRole("tab", { name: "Sizes" }).click();
      await expect(page.getByLabel("Chest width in centimetres")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

      await bar.getByRole("button", { name: "Assistant" }).click();
      const sheet = page.getByRole("dialog", { name: "Design assistant" });
      await expect(sheet.getByLabel("Describe a change")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(bar.getByRole("button", { name: "Assistant" })).toBeFocused();
    });
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

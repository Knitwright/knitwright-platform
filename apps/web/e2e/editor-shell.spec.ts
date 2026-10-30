import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createAccount, openTool, signIn, test } from "./support";

/**
 * Plan v5 Y2 (spec F-S4, decision 0075): the editor shell. The top bar, the segmented
 * Form | Library | Specs rail, the canvas with its 2D | 3D | Tech pack toggle, the bottom bar and
 * the Design Summary, and the Form toolbar that only ever offers factory-approved options and
 * ranges.
 *
 * Each test makes its own account and its own design name, so nothing it filters on can be
 * another run's row (plan v5, lesson 11).
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // The session cookie arrives with the redirect: follow it before going anywhere else.
  await expect(page).toHaveURL(/\/studio$/);
};

const startDesign = async (page: Page, type: string, label: string): Promise<string> => {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: type });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname;
};

/** A team jersey is the worked base article JSY-SS-01, so it has approved options and ranges. */
const startJersey = (page: Page, label: string) => startDesign(page, "Team jersey", label);

test.describe("the editor shell", () => {
  test("has the top bar, the rail, the canvas, the bottom bar and the Design Summary", async ({ page }) => {
    await signedIn(page, "shell-layout");
    await startJersey(page, "Shell kit");

    await expect(page.getByTestId("file-menu-button")).toBeVisible();
    await expect(page.getByTestId("validate-chip")).toBeVisible();
    await expect(page.getByRole("link", { name: "Share", exact: true })).toBeVisible();
    await expect(page.getByTestId("export-button")).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Toolbars" }).getByRole("tab")).toHaveText(["Form", "Library", "Specs"]);
    await expect(page.getByTestId("view-toggle").getByRole("button")).toHaveText(["2D", "3D", "Tech pack"]);
    await expect(page.getByTestId("design-summary")).toContainText("Design summary");
    await expect(page.getByTestId("canvas-bottom-bar")).toBeVisible();
  });

  test("moves between the three toolbars with the arrow keys and shows each one's panel", async ({ page }) => {
    await signedIn(page, "shell-rail");
    await startJersey(page, "Rail kit");
    const toolbars = page.getByRole("tablist", { name: "Toolbars" });

    await expect(toolbars.getByRole("tab", { name: "Form" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("form-toolbar")).toBeVisible();

    await toolbars.getByRole("tab", { name: "Form" }).focus();
    await page.keyboard.press("ArrowRight");

    await expect(toolbars.getByRole("tab", { name: "Library" })).toBeFocused();
    await expect(toolbars.getByRole("tab", { name: "Library" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("editor-slot-library")).toContainText("workstream Y3");
    await expect(page).toHaveURL(/rail=library/);

    await page.keyboard.press("End");
    await expect(toolbars.getByRole("tab", { name: "Specs" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("editor-slot-specs")).toContainText("workstream Y4");

    // Back on Form, the workspace's own eleven tools are where they always were.
    await page.keyboard.press("Home");
    await expect(page.getByRole("tablist", { name: "Tools" }).getByRole("tab")).toHaveCount(11);
    await openTool(page, "Sizes");
    await expect(page.getByLabel("Chest width in centimetres")).toBeVisible();
  });

  test("opens a base article in 3D with the placeholder model labelled, and keeps the version across views", async ({ page }) => {
    await signedIn(page, "shell-views");
    await startJersey(page, "Views kit");

    await expect(page).not.toHaveURL(/view=2d/);
    const three = page.getByRole("region", { name: "3D view" });
    await expect(three).toBeVisible();
    await expect(three).toContainText("placeholder, not an artist model");
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await page.getByTestId("view-toggle").getByRole("button", { name: "2D" }).click();
    await expect(page.getByRole("region", { name: "2D pattern view" })).toBeVisible();
    await expect(page.getByTestId("editor-slot-view-2d")).toContainText("workstream Y3");
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await page.getByTestId("view-toggle").getByRole("button", { name: "Tech pack" }).click();
    await expect(page.getByTestId("editor-slot-tech-pack")).toContainText("workstream Y4");
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    // Side by side: two views of the same design version at once.
    await page.getByLabel("Side by side").check();
    await expect(page.getByRole("region", { name: "2D pattern view" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tech pack view" })).toBeVisible();
  });

  test("offers only the base article's approved options, with their catalogue codes and ranges", async ({ page }) => {
    await signedIn(page, "shell-form");
    await startJersey(page, "Form kit");
    const collar = page.getByTestId("option-group-collar");

    await expect(collar).toContainText("Collar options of JSY-SS-01");
    await expect(collar.getByRole("radio")).toHaveCount(3);
    await expect(collar.getByRole("radio", { name: /^C01/ })).toBeChecked();
    await expect(page.getByTestId("option-group-sleeve_finish").getByRole("radio")).toHaveCount(2);

    const slider = page.getByTestId("parameter-body_length_offset");
    await expect(slider).toContainText("Body length +0 mm · range −30 to +40");
    const range = slider.getByRole("slider");
    await expect(range).toHaveAttribute("min", "-30");
    await expect(range).toHaveAttribute("max", "40");
    await expect(range).toHaveAttribute("step", "10");
  });

  test("names the design from its form, and a length change re-drafts and shows in the address", async ({ page }) => {
    await signedIn(page, "shell-autoname");
    await startJersey(page, "Autoname kit");

    await expect(page.getByTestId("auto-name")).toHaveText("Crew neck · Coverstitch hem · Plain");

    // The slider moves in the article's own step of 10 mm, with the keyboard alone.
    const slider = page.getByTestId("parameter-body_length_offset").getByRole("slider");
    await slider.focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByTestId("auto-name")).toHaveText("Crew neck · Coverstitch hem · Plain · Body length +10 mm");
    await expect(page).toHaveURL(/par=body_length_offset%3A10/);
    // The pattern was drafted again for the new length, so the 3D view still has its model.
    await expect(page.getByRole("region", { name: "3D view" })).toContainText("placeholder, not an artist model");
  });

  test("makes a value outside the approved range impossible, however the address asks for it", async ({ page }) => {
    await signedIn(page, "shell-range");
    const path = await startJersey(page, "Range kit");

    await page.goto(`${path}?par=body_length_offset:500`);

    await expect(page.getByTestId("parameter-body_length_offset").getByRole("slider")).toHaveValue("0");
    await expect(page.getByTestId("auto-name")).toHaveText("Crew neck · Coverstitch hem · Plain");
  });

  test("locks an option no sample has signed off, says so, and explains the rule behind it", async ({ page }) => {
    await signedIn(page, "shell-sampled");
    await startJersey(page, "Sampled kit");
    const collar = page.getByTestId("option-group-collar");

    await expect(collar).toContainText("Not yet sampled");

    await collar.getByRole("button", { name: "Why? Rulebook R-CON-004" }).click();

    // Owner decision 11: no factory has confirmed a rule yet, so the popover names the rule and
    // says the words are not shown rather than reading out a draft.
    await expect(page.getByTestId("why-panel")).toContainText("R-CON-004");
    await expect(page.getByTestId("why-panel")).toContainText("not yet confirmed by the factory");
  });

  test("shows every finding with a Why? behind the Validate chip", async ({ page }) => {
    await signedIn(page, "shell-validate");
    await startJersey(page, "Validate kit");

    await page.getByTestId("validate-chip").click();

    const list = page.locator("#validate-findings");
    await expect(list).toContainText("has no golden sample behind it yet");
    await expect(list.getByRole("button", { name: /^Why\? Rulebook R-/ }).first()).toBeVisible();
  });

  test("opens a Design Summary row's editor in place, and keeps the base article's stitches read-only", async ({ page }) => {
    await signedIn(page, "shell-summary");
    await startJersey(page, "Summary kit");
    const summary = page.getByTestId("design-summary");

    await expect(summary).toContainText("Stitches (from base)");
    await summary.getByRole("button", { name: /Main fabric/ }).click();

    await expect(page).toHaveURL(/tool=fabric/);
    await expect(page.getByRole("tab", { name: "Fabric", exact: true })).toHaveAttribute("aria-selected", "true");
  });

  test("adds a colourway from the bottom bar and shows the size the canvas is drawn at", async ({ page }) => {
    await signedIn(page, "shell-bottom");
    await startJersey(page, "Bottom kit");

    await expect(page.getByLabel("Size shown")).toHaveValue("M");
    await page.getByTestId("new-colourway").click();

    await expect(page.getByTestId("save-status")).toHaveText("Saved as version 2.");
    await expect(page.getByLabel("Kit colourway")).toContainText("Home");
  });

  test("says plainly that an article with no approved form on file has none", async ({ page }) => {
    await signedIn(page, "shell-bare");
    await startDesign(page, "Crew neck tee", "Bare tee");

    await expect(page.getByTestId("form-toolbar-empty")).toContainText("TEE-TR-01 has no options or ranges on file yet");
    // With nothing drafted there is no model, so the canvas opens on the drawing.
    await expect(page.getByRole("region", { name: "2D pattern view" })).toBeVisible();
    await expect(page.getByTestId("flat-front")).toBeVisible();
  });

  test("offers a redo only once something has been undone, and puts that version back", async ({ page }) => {
    await signedIn(page, "shell-redo");
    await startDesign(page, "Crew neck tee", "Redo tee");
    const redo = page.getByRole("button", { name: "Redo" });

    await expect(redo).toBeDisabled();
    await openTool(page, "Sizes");
    const chest = page.getByLabel("Chest width in centimetres");
    await chest.fill("48");
    await chest.press("Enter");
    await expect(page.getByTestId("save-status")).toHaveText("Saved as version 2.");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("save-status")).toHaveText("Saved as version 3.");
    await expect(chest).toHaveValue("51");

    await expect(redo).toBeEnabled();
    await redo.click();

    await expect(page.getByTestId("save-status")).toHaveText("Saved as version 4.");
    await expect(chest).toHaveValue("48");
    await expect(redo).toBeDisabled();
  });

  test("lists the panels of the shell in the File menu, and opens one in place", async ({ page }) => {
    await signedIn(page, "shell-file");
    await startJersey(page, "File kit");

    await page.getByTestId("file-menu-button").click();
    const menu = page.getByRole("list", { name: "File" });
    await expect(menu.getByRole("link")).toHaveText(["Design details", "Version history", "Share…", "Factory file", "Make and order", "Move to trash…"]);

    await menu.getByRole("link", { name: "Version history" }).click();

    await expect(page).toHaveURL(/tool=history/);
    await expect(page.getByRole("heading", { level: 2, name: "History" })).toBeVisible();
  });
});

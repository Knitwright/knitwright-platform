import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createAccount, openEditorPanel, signIn, test } from "./support";

/**
 * Plan v5 L1 (spec Launch section, decision 0091): the launch shell. The icon rail with a labelled
 * placeholder for every panel L2 to L8 will fill, the canvas with its Add… menus, the right
 * inspector with the artboard size and the project palette, the task bar, the bottom dock, the main
 * menu and the version history.
 *
 * The garment lock is checked on the screen and not only in the unit tests: a board with no Design
 * board behind it says so, and the task bar will not offer to change the garment in a picture the
 * platform drew.
 *
 * Each test makes its own account and its own launch name, so nothing it filters on can be another
 * run's row (plan v5, lesson 11). CI retries a failed browser test once.
 *
 * The axe scan is scoped to this workstream's own chrome, `[data-testid="launch-shell"]`: the shared
 * studio header is another workstream's file and is known to be over its width, and a fault there
 * must not read as a fault here.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // The session cookie arrives with the redirect: follow it before going anywhere else.
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

/** A launch project with no design behind it, which is the state the garment lock talks about. */
const startLaunch = async (page: Page, label: string): Promise<{ name: string; path: string }> => {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/launch");
  await expect(page.getByRole("heading", { level: 1, name: "Launch projects" })).toBeVisible();
  await page.getByLabel("Name this launch").fill(name);
  await page.getByRole("button", { name: "Start the launch" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return { name, path: new URL(page.url()).pathname };
};

test.describe("the launch list", () => {
  test("shows a real empty state, then the project it just started", async ({ page }) => {
    await signedIn(page, "launch-list");
    await page.goto("/launch");

    await expect(page.getByRole("heading", { level: 2, name: "No launch project yet" })).toBeVisible();

    const { name } = await startLaunch(page, "List kit");
    await page.goto("/launch");

    await expect(page.getByRole("link", { name })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "No launch project yet" })).toBeHidden();
  });

  test("answers 404 for a canvas that does not exist", async ({ page }) => {
    await signedIn(page, "launch-missing");
    const response = await page.goto(`/launch/${randomUUID()}`);

    expect(response?.status()).toBe(404);
  });
});

test.describe("the launch shell", () => {
  test("has the rail, the canvas, the inspector, the dock and the menu, and one h1", async ({ page }) => {
    await signedIn(page, "launch-chrome");
    await startLaunch(page, "Chrome kit");

    await expect(page.getByRole("tablist", { name: "Panels" }).getByRole("tab")).toHaveCount(11);
    await expect(page.getByTestId("launch-canvas")).toBeVisible();
    await expect(page.getByTestId("launch-inspector")).toBeVisible();
    await expect(page.getByTestId("launch-dock")).toBeVisible();
    await expect(page.getByTestId("launch-menu-button")).toBeVisible();
    await expect(page.getByTestId("launch-prompt")).toHaveAttribute("placeholder", /Describe what you want to create/);
    await expect(page.getByTestId("launch-shell").getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("moves between the rail's flyouts with the arrow keys, and closes one pressed again", async ({ page }) => {
    await signedIn(page, "launch-rail");
    await startLaunch(page, "Rail kit");
    const panels = page.getByRole("tablist", { name: "Panels" });

    // The editor opens on Products, as the reference does (decision 0146).
    await expect(panels.getByRole("tab", { name: "Products" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("editor-products")).toBeVisible();

    // The Templates panel is built (decision 0108), so it shows the library rather than a placeholder.
    await openEditorPanel(page, "Templates");
    await expect(page.getByTestId("launch-templates-panel")).toBeVisible();
    await expect(page.getByTestId("launch-panel-templates")).toHaveCount(0);

    await panels.getByRole("tab", { name: "Templates" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(panels.getByRole("tab", { name: "Text" })).toBeFocused();
    // L4's Text panel is mounted (decision 0094), so this one shows the panel itself.
    await expect(page.getByTestId("marketing-panel-text")).toBeVisible();
    await expect(page.getByTestId("launch-panel-text")).toHaveCount(0);
    await expect(page).toHaveURL(/panel=text/);

    await page.keyboard.press("End");
    await expect(panels.getByRole("tab", { name: "Help" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("editor-help")).toContainText("Zoom in");

    // Mockups and Photos are built (L2, decision 0092); Photos is an app under More now.
    await openEditorPanel(page, "Mockups");
    await expect(page.getByTestId("mockups-panel")).toBeVisible();
    await expect(page.getByTestId("launch-panel-mockups")).toHaveCount(0);

    // Pressing the lit item closes its flyout.
    await panels.getByRole("tab", { name: "Mockups" }).click();
    await expect(page.getByTestId("editor-flyout")).toBeHidden();

    // Likes is the one panel still waiting: nothing records a like (0108's own owner question).
    await openEditorPanel(page, "Likes");
    await expect(page.getByTestId("launch-panel-likes")).toContainText("workstream L8");
  });

  test("lists every board in Layers and brings a chosen one onto the screen", async ({ page }) => {
    await signedIn(page, "launch-layers");
    await startLaunch(page, "Layers kit");
    await page.getByTestId("launch-empty-action").click();
    await expect(page.getByRole("article", { name: "Design board" })).toBeVisible();

    await openEditorPanel(page, "Layers");
    const row = page.getByTestId("editor-layers").getByRole("button", { name: /Design/ }).first();
    await row.click();
    await expect(row).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/board=/);
    await expect(page.getByTestId("launch-task-bar")).toBeVisible();
  });

  test("answers the editor's shortcuts and opens a board's menu with the keyboard", async ({ page }) => {
    await signedIn(page, "launch-keys");
    await startLaunch(page, "Keys kit");
    await page.getByTestId("launch-empty-action").click();
    await expect(page.getByRole("article", { name: "Design board" })).toBeVisible();

    await page.getByTestId("flow-canvas").focus();
    await page.keyboard.press("t");
    await expect(page).toHaveURL(/tool=text/);
    await page.keyboard.press("v");
    await expect(page).toHaveURL(/tool=select/);

    await expect(page.getByTestId("zoom-percent")).toHaveText("100%");
    await page.keyboard.press("ControlOrMeta+-");
    await expect(page.getByTestId("zoom-percent")).toHaveText("75%");

    const board = page.locator("[data-board-id]").first();
    await board.focus();
    await page.keyboard.press("Shift+F10");
    const menu = page.getByRole("menu", { name: /menu$/ });
    await expect(menu.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("has no Apps icon, because this platform has no store", async ({ page }) => {
    await signedIn(page, "launch-no-apps");
    await startLaunch(page, "No apps kit");

    await expect(page.getByRole("tablist", { name: "Panels" }).getByRole("tab", { name: "Apps" })).toHaveCount(0);
  });

  test("keeps the whole shell free of serious accessibility problems", async ({ page }) => {
    await signedIn(page, "launch-axe");
    await startLaunch(page, "Axe kit");

    const results = await new AxeBuilder({ page }).include('[data-testid="launch-shell"]').analyze();
    const serious = results.violations.filter((one) => one.impact === "serious" || one.impact === "critical");

    expect(serious.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

test.describe("the canvas and the garment lock", () => {
  test("asks for a Design board first, and takes one", async ({ page }) => {
    await signedIn(page, "launch-empty");
    await startLaunch(page, "Empty kit");

    const empty = page.getByTestId("launch-empty");
    await expect(empty).toContainText("Nothing on this canvas yet");
    await expect(page.getByTestId("launch-empty-action")).toHaveText("Add a Design board");

    await page.getByTestId("launch-empty-action").click();
    // The boards are L6's flow canvas now (decision 0096): the same contract, with the connectors,
    // the dragging and the keyboard moves L1 left to it.
    await expect(page.getByTestId("flow-canvas")).toBeVisible();
    await expect(page.getByRole("article", { name: "Design board" })).toBeVisible();
  });

  test("offers after a Design board only the boards the spec's table allows", async ({ page }) => {
    await signedIn(page, "launch-add-menu");
    await startLaunch(page, "Menu kit");
    await page.getByTestId("launch-empty-action").click();
    await expect(page.getByRole("article", { name: "Design board" })).toBeVisible();

    // The right-edge dot of the spec, as a labelled button: a dot alone is not operable. Its name
    // starts with the word on it, which is what WCAG 2.5.3 asks of every control on the card.
    await page.getByRole("button", { name: /^Add…/ }).click();
    const menu = page.getByRole("list", { name: /^Add a board after/ });

    await expect(menu.getByRole("button")).toHaveText([/^Mockup/, /^AI image/, /^Marketing/, /^Info card/]);
    await expect(menu.getByRole("button", { name: /^AI video/ })).toHaveCount(0);

    await menu.getByRole("button", { name: /^Mockup/ }).click();
    await expect(page.getByRole("article", { name: "Mockup board" })).toBeVisible();
  });

  test("says a board with no design behind it cannot run, and will not run it", async ({ page }) => {
    await signedIn(page, "launch-lock");
    await startLaunch(page, "Lock kit");

    // An AI image board added from the inspector's tools, with nothing feeding it.
    await page.getByTestId("add-ai_image").click();
    const board = page.getByRole("article", { name: "AI image board" });
    await expect(board).toBeVisible();

    await board.getByRole("button", { name: "Select AI image" }).click();
    await expect(page).toHaveURL(/board=/);
    await expect(page.getByTestId("garment-lock-note")).toContainText("Connect a Design board first");
    await expect(page.getByTestId("launch-run")).toHaveText("Nothing to run");
    await expect(page.getByTestId("launch-run")).toBeDisabled();
  });

  test("will not offer to change the garment in a picture the platform drew", async ({ page }) => {
    await signedIn(page, "launch-task-bar");
    await startLaunch(page, "Task kit");
    await page.getByTestId("launch-empty-action").click();
    const board = page.getByRole("article", { name: "Design board" });
    await board.getByRole("button", { name: "Select Design" }).click();

    const bar = page.getByTestId("launch-task-bar");
    await expect(bar).toHaveAttribute("aria-label", /Design board/);
    await expect(page.getByTestId("task-download")).toBeDisabled();
    await expect(page.getByTestId("task-download")).toHaveAttribute("title", /Run this board first/);
  });
});

test.describe("the inspector, the dock and the menu", () => {
  test("shows the artboard size in the unit asked for, with the presets as rows", async ({ page }) => {
    await signedIn(page, "launch-artboard");
    await startLaunch(page, "Artboard kit");
    await page.getByTestId("launch-empty-action").click();
    await page.getByRole("article", { name: "Design board" }).getByRole("button", { name: "Select Design" }).click();

    const size = page.getByTestId("artboard-size");
    await expect(size.getByLabel("Width (px)")).toHaveValue("1080");

    await size.getByLabel("Unit").selectOption("mm");
    await expect(size.getByLabel("Width (mm)")).toHaveValue("381.0");
    await expect(page.getByTestId("artboard-print-size")).toContainText("mm ×");

    await size.getByRole("button", { name: "Story 9:16" }).click();
    await expect(page.getByTestId("artboard-print-size")).toContainText("9:16");
  });

  test("refuses a size the canvas cannot draw, and says what the bound is", async ({ page }) => {
    await signedIn(page, "launch-size-refusal");
    await startLaunch(page, "Size kit");
    await page.getByTestId("launch-empty-action").click();
    await page.getByRole("article", { name: "Design board" }).getByRole("button", { name: "Select Design" }).click();

    const size = page.getByTestId("artboard-size");
    await size.getByLabel("Width (px)").fill("4");
    await size.getByLabel("Width (px)").press("Enter");

    await expect(size.getByRole("alert")).toContainText("The smallest artboard is 16 px.");
  });

  test("keeps the project colours, and zooms", async ({ page }) => {
    await signedIn(page, "launch-colours");
    await startLaunch(page, "Colour kit");

    const colours = page.getByTestId("project-colours");
    await expect(colours).toContainText("No colour on this project yet");
    await colours.getByLabel("Name it").fill("Club navy");
    await page.getByTestId("add-colour").click();
    await expect(colours.getByText("Club navy", { exact: true })).toBeVisible();

    await expect(page.getByTestId("zoom-percent")).toHaveText("100%");
    await page.getByTestId("zoom-out").click();
    await expect(page.getByTestId("zoom-percent")).toHaveText("75%");
    await expect(page).toHaveURL(/zoom=75/);
  });

  test("saves a version from the main menu and shows it in the version history", async ({ page }) => {
    await signedIn(page, "launch-version");
    const { path } = await startLaunch(page, "Version kit");

    await page.getByTestId("launch-menu-button").click();
    await page.getByTestId("launch-menu-save").click();
    // The shell says which version it wrote, so the history is read after the write has landed.
    await expect(page.getByTestId("launch-note")).toContainText("Version 1 saved");

    // The history stays under the launch address; the canvas itself is the one canvas (decision 0145).
    await page.goto(`${path.replace("/project/", "/launch/")}/history`);
    await expect(page.getByRole("heading", { level: 1, name: "Version history" })).toBeVisible();
    await expect(page.getByText("Version 1")).toBeVisible();
  });

  test("sets the project's unit from the menu's settings, millimetres among them", async ({ page }) => {
    await signedIn(page, "launch-units");
    await startLaunch(page, "Units kit");

    await page.getByTestId("launch-menu-button").click();
    await page.getByTestId("launch-menu-settings").click();
    await page.getByTestId("launch-settings").getByRole("menuitemradio", { name: "Millimetres" }).click();

    await expect(page).toHaveURL(/unit=mm/);
    await page.reload();
    await expect(page).toHaveURL(/unit=mm/);
  });
});

/**
 * The phone layout, following the pattern this app already uses for the editor's rail (decision
 * 0064 and `components/studio/workspace/ToolRail.tsx`): the rail becomes a bar fixed along the
 * bottom of the screen, the canvas comes first, and nothing scrolls sideways.
 */
test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("puts the rail along the bottom, keeps the inspector reachable and never scrolls sideways", async ({ page }) => {
    await signedIn(page, "launch-phone");
    await startLaunch(page, "Phone kit");

    const rail = page.getByTestId("launch-rail");
    await expect(rail).toBeVisible();
    expect(await rail.evaluate((node) => getComputedStyle(node).position)).toBe("fixed");

    // The inspector is stacked below rather than taken away: an artboard size is not optional.
    await expect(page.getByTestId("launch-inspector")).toBeVisible();
    await expect(page.getByTestId("launch-dock")).toBeVisible();

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(1);
  });
});

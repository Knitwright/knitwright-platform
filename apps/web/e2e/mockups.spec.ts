import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * Plan v5 L2 (spec F-L1's free part, decision 0092): the mockup studio inside the launch shell. The
 * library panel with its collections, its search and its crown; the mockup board's inspector with the
 * scene, the kit and the shirt; and the rules the spec puts on the page said on the page -- the
 * garment is locked, and the scene decides where it sits.
 *
 * Each test makes its own account and its own launch name, so nothing it filters on can be another
 * run's row (plan v5, lesson 11). CI retries a failed browser test once.
 *
 * The axe scan is scoped to the launch shell, as L1's own spec scopes it: the shared studio header is
 * another workstream's file and is known to be over its width.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // The session cookie arrives with the redirect: follow it before going anywhere else.
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

const startLaunch = async (page: Page, label: string): Promise<string> => {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/launch");
  await expect(page.getByRole("heading", { level: 1, name: "Launch projects" })).toBeVisible();
  await page.getByLabel("Name this launch").fill(name);
  await page.getByRole("button", { name: "Start the launch" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return name;
};

const openMockups = async (page: Page): Promise<void> => {
  await page.getByRole("tablist", { name: "Panels" }).getByRole("tab", { name: "Mockups" }).click();
  await expect(page.getByTestId("mockups-panel")).toBeVisible();
};

test.describe("the mockup library panel", () => {
  test("shows the collections of the spec, the free scenes and the ones that cost credits", async ({ page }) => {
    await signedIn(page, "mockup-library");
    await startLaunch(page, "Library kit");
    await openMockups(page);

    const panel = page.getByTestId("mockups-panel");
    await expect(panel.getByRole("heading", { level: 2, name: "Mockups" })).toBeVisible();
    await expect(page.getByTestId("mockup-collection-product")).toBeVisible();
    await expect(page.getByTestId("mockup-collection-teamwear")).toBeVisible();
    await expect(page.getByTestId("mockup-scene-product-front")).toContainText("Free");
    await expect(page.getByTestId("mockup-scene-dojo-mat")).toContainText("Credits");
    await expect(panel).toContainText("never the garment");
  });

  test("shows all of a collection, then fewer", async ({ page }) => {
    await signedIn(page, "mockup-show-all");
    await startLaunch(page, "Show all kit");
    await openMockups(page);

    // Six of the ten product shots show until Show all is pressed.
    await expect(page.getByTestId("mockup-scene-turntable-360")).toBeHidden();
    await page.getByTestId("mockup-show-all-product").click();
    await expect(page.getByTestId("mockup-scene-turntable-360")).toBeVisible();

    await page.getByTestId("mockup-show-all-product").click();
    await expect(page.getByTestId("mockup-scene-turntable-360")).toBeHidden();
  });

  test("searches and filters, and says so when nothing matches", async ({ page }) => {
    await signedIn(page, "mockup-search");
    await startLaunch(page, "Search kit");
    await openMockups(page);

    await page.getByLabel("Search the scenes").fill("flat lay");
    await expect(page.getByTestId("mockup-scene-flat-lay-white")).toBeVisible();
    await expect(page.getByTestId("mockup-scene-dojo-mat")).toBeHidden();

    await page.getByLabel("Search the scenes").fill("nothing matches this at all");
    await expect(page.getByTestId("mockup-no-match")).toContainText("No scene matches that");
    await page.getByTestId("mockup-clear-filters").click();
    await expect(page.getByTestId("mockup-scene-dojo-mat")).toBeVisible();

    await page.getByTestId("mockup-free-only").check();
    await expect(page.getByTestId("mockup-scene-dojo-mat")).toBeHidden();
    await expect(page.getByTestId("mockup-scene-product-front")).toBeVisible();
  });

  test("says a turned view is a turned drawing, with its rule, rather than looking ready", async ({ page }) => {
    await signedIn(page, "mockup-gap");
    await startLaunch(page, "Gap kit");
    await openMockups(page);

    const card = page.getByTestId("mockup-scene-product-three-quarter");
    await expect(card).toContainText("What this cannot show yet");
    await expect(card).toContainText("R-GAP-000");
  });

  test("says what it cannot filter on, and that the spec asks for more scenes than it names", async ({ page }) => {
    await signedIn(page, "mockup-filter-gap");
    await startLaunch(page, "Filter gap kit");
    await openMockups(page);

    await expect(page.getByTestId("mockup-article-filter-gap")).toContainText("article filter");
    await expect(page.getByTestId("mockup-count-gap")).toContainText("asks for 40 mockup scenes");
  });
});

test.describe("the photos panel", () => {
  test("shows a real empty state and opens the panel that fills it", async ({ page }) => {
    await signedIn(page, "mockup-photos");
    await startLaunch(page, "Photos kit");
    await page.getByRole("tablist", { name: "Panels" }).getByRole("tab", { name: "Photos" }).click();

    await expect(page.getByTestId("photos-empty")).toContainText("No photograph yet");
    await page.getByTestId("photos-open-uploads").click();
    await expect(page).toHaveURL(/panel=uploads/);
  });
});

test.describe("a mockup board", () => {
  test("asks for a scene, takes one from the library, and then shows the kit and the shirt", async ({ page }) => {
    await signedIn(page, "mockup-board");
    await startLaunch(page, "Board kit");

    // A Design board first, so the mockup has a garment to follow.
    await page.getByTestId("launch-empty-action").click();
    await expect(page.getByRole("article", { name: "Design board" })).toBeVisible();

    await openMockups(page);
    await page.getByTestId("mockup-use-product-front").click();
    await expect(page.getByRole("article", { name: "Mockup board" })).toBeVisible();

    await page.getByRole("article", { name: "Mockup board" }).getByRole("button", { name: "Select Mockup" }).click();
    await expect(page.getByTestId("mockup-board-no-scene")).toContainText("No scene on this board yet");

    await openMockups(page);
    await page.getByTestId("mockup-use-product-front").click();
    await expect(page.getByTestId("mockup-board-scene")).toHaveText("Front render");

    // The checkbox is a saved setting, not local state: the shell writes it and redraws, so the box
    // is clicked and the saved state waited for, rather than asserted in the same tick.
    await page.getByTestId("mockup-board-roster-on").click();
    await expect(page.getByTestId("mockup-board-roster-on")).toBeChecked();
    await expect(page.getByTestId("mockup-board-roster-shown")).toContainText("PLAYER 10");
    await expect(page.getByTestId("mockup-board-panel")).toContainText("cannot be dragged");
  });

  test("will not bake a board into a picture before it has one", async ({ page }) => {
    await signedIn(page, "mockup-convert");
    await startLaunch(page, "Convert kit");
    await page.getByTestId("add-mockup").click();
    await page.getByRole("article", { name: "Mockup board" }).getByRole("button", { name: "Select Mockup" }).click();

    await openMockups(page);
    await page.getByTestId("mockup-use-flat-lay-white").click();

    await expect(page.getByTestId("mockup-board-needs-design")).toContainText("Connect a Design board");
    await expect(page.getByTestId("mockup-board-convert")).toBeDisabled();
    await expect(page.getByTestId("mockup-board-convert")).toHaveAttribute("title", /Draw this mockup first/);
  });
});

test.describe("accessibility", () => {
  test("keeps the mockup library free of serious accessibility problems", async ({ page }) => {
    await signedIn(page, "mockup-axe");
    await startLaunch(page, "Axe mockup kit");
    await openMockups(page);
    await page.getByTestId("mockup-show-all-product").click();

    const results = await new AxeBuilder({ page }).include('[data-testid="launch-shell"]').analyze();
    const serious = results.violations.filter((one) => one.impact === "serious" || one.impact === "critical");

    expect(serious.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test("keeps the mockup board's inspector free of serious accessibility problems", async ({ page }) => {
    await signedIn(page, "mockup-board-axe");
    await startLaunch(page, "Axe board kit");
    await page.getByTestId("add-mockup").click();
    await page.getByRole("article", { name: "Mockup board" }).getByRole("button", { name: "Select Mockup" }).click();
    await openMockups(page);
    await page.getByTestId("mockup-use-product-three-quarter").click();
    await expect(page.getByTestId("mockup-board-scene")).toHaveText("Three-quarter render");
    await page.getByTestId("mockup-board-roster-on").click();
    await expect(page.getByTestId("mockup-board-roster-name")).toBeVisible();

    const results = await new AxeBuilder({ page }).include('[data-testid="launch-inspector"]').analyze();
    const serious = results.violations.filter((one) => one.impact === "serious" || one.impact === "critical");

    expect(serious.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

/**
 * The phone layout, following the pattern this app already uses (decision 0064 and
 * `components/studio/workspace/ToolRail.tsx`, as L1's own shell does): the rail becomes a bar along
 * the bottom, the panels stack, and nothing scrolls sideways.
 */
test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("shows the library stacked, and never scrolls sideways", async ({ page }) => {
    await signedIn(page, "mockup-phone");
    await startLaunch(page, "Phone mockup kit");
    await openMockups(page);

    await expect(page.getByTestId("mockup-collection-product")).toBeVisible();
    await expect(page.getByTestId("mockup-scene-product-front")).toBeVisible();

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(1);
  });
});

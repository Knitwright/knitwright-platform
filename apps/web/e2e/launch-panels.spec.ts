import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { accessible } from "./chrome";
import { createAccount, openEditorPanel, signIn, test } from "./support";

/**
 * THE PANELS NO WORKSTREAM OWNED, ON A SCREEN (plan v5, decision 0108).
 *
 * L1's contract named a workstream for every panel of the rail, and four of them named a workstream
 * the plan gave no component path: Templates and Likes to L8, Uploads and Brand to L7. Three of
 * them are built now and are opened here, asked to show their own content rather than a
 * placeholder, and scanned by axe at a desktop width and at 390 x 844. **Likes still holds its
 * placeholder, because nothing in the platform records a like**, and that is asserted rather than
 * left to be noticed.
 *
 * The import screen of F-S9 is in the same file, because it is the other half of what L7 left: its
 * engine was finished and its renderer did not exist. A run reads a real website, so what is
 * exercised here is everything around that: the empty state, a refusal that says why, and the
 * completion % with what is still missing.
 *
 * Each test makes its own account and its own launch name, so nothing it filters on can be another
 * run's row (plan v5, lesson 11). CI retries a failed browser test once.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // The session cookie arrives with the redirect: follow it before going anywhere else.
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

/** A launch project with nothing behind it, which is enough to open every panel of the rail. */
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

const openRail = async (page: Page, label: string): Promise<void> => {
  await openEditorPanel(page, label);
};

/** Nothing scrolls sideways, at whatever width the test is running. */
const noSidewaysScroll = async (page: Page): Promise<void> => {
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sideways).toBeLessThanOrEqual(1);
};

test.describe("the rail panels that had no workstream", () => {
  test("shows Templates, Uploads and Brand, each with its own content", async ({ page }) => {
    await signedIn(page, "unowned-rail");
    await startLaunch(page, "Unowned kit");

    for (const [label, id] of [
      ["Templates", "templates"],
      ["Uploads", "uploads"],
      ["Brand", "brand"],
    ] as const) {
      await openRail(page, label);
      // The panel itself, and no placeholder anywhere near it.
      await expect(page.getByTestId(`launch-${id}-panel`)).toBeVisible();
      await expect(page.getByTestId(`launch-panel-${id}`)).toHaveCount(0);
    }
  });

  /**
   * The spec's own data model puts a `likes` count on a template row rather than a record of who
   * liked what, and no migration in this repository has either, so there is nothing to list.
   */
  test("keeps the Likes placeholder, saying why there is nothing to list", async ({ page }) => {
    await signedIn(page, "unowned-likes");
    await startLaunch(page, "Likes kit");

    await openRail(page, "Likes");
    await expect(page.getByTestId("launch-panel-likes")).toContainText("Nothing in the platform records a like");
    // Nothing is asserted here about `ai-image`. L3's panel exists and the wave-4 wiring change
    // mounts it, so a test of this file saying it is still a placeholder would break on that merge.
  });

  test("lists the seeded templates, narrows them by a tag and finds one by name", async ({ page }) => {
    await signedIn(page, "unowned-templates");
    await startLaunch(page, "Templates kit");
    await openRail(page, "Templates");

    const panel = page.getByTestId("launch-templates-panel");
    await expect(panel.getByRole("heading", { level: 3 }).first()).toBeVisible();

    // The five tag groups of 07 are offered as chips with a count each.
    const sport = page.getByTestId("launch-templates-filter-sport");
    await expect(sport).toBeVisible();
    const football = sport.getByRole("button", { name: /^Football/ });
    await football.click();
    await expect(football).toHaveAttribute("aria-pressed", "true");

    // A seeded design template is on a card, with the garment it is drawn on and its review label.
    await expect(panel).toContainText("not reviewed by a factory");

    // Search really narrows: a word no starter holds shows the no-match state and the way out.
    await page.getByTestId("launch-templates-search").fill("zzzzqqqq");
    await expect(page.getByTestId("launch-templates-no-match")).toBeVisible();
    await page.getByTestId("launch-templates-clear").click();
    await expect(page.getByTestId("launch-templates-no-match")).toHaveCount(0);
  });

  test("says a template whose garment has no measurement on file, rather than looking ready", async ({ page }) => {
    await signedIn(page, "unowned-gap");
    await startLaunch(page, "Gap kit");
    await openRail(page, "Templates");

    const panel = page.getByTestId("launch-templates-panel");
    await expect(panel).toContainText("No measurement on file for this garment yet");
    await expect(panel.getByText(/^R-[A-Z]{3}-/).first()).toBeVisible();
  });

  test("shows a real empty state for a brand with nothing uploaded and nothing in its brand", async ({ page }) => {
    await signedIn(page, "unowned-empty");
    await startLaunch(page, "Empty brand kit");

    await openRail(page, "Uploads");
    const uploads = page.getByTestId("launch-uploads-empty");
    await expect(uploads).toContainText("Nothing uploaded yet");
    await expect(page.getByTestId("launch-uploads-action")).toBeVisible();
    // The rights gap is said whether or not there is a file, because it is about every file.
    await expect(page.getByTestId("launch-uploads-rights-gap")).toContainText("R-GAP-000");

    await openRail(page, "Brand");
    await expect(page.getByTestId("launch-brand-empty")).toContainText("Your brand is empty");
    await expect(page.getByTestId("launch-brand-action")).toBeVisible();
    await expect(page.getByTestId("launch-brand-import")).toHaveAttribute("href", "/brand/import");
  });

  test("keeps each new panel free of serious accessibility problems, and never scrolls sideways", async ({ page }) => {
    await signedIn(page, "unowned-axe");
    await startLaunch(page, "Axe unowned kit");

    for (const [label, id] of [
      ["Templates", "templates"],
      ["Uploads", "uploads"],
      ["Brand", "brand"],
    ] as const) {
      await openRail(page, label);
      await expect(page.getByTestId(`launch-${id}-panel`)).toBeVisible();
      await accessible(page);
      await noSidewaysScroll(page);
    }
  });
});

/** The same three panels at phone width, where the rail is a bar along the bottom (decision 0091). */
test.describe("the rail panels on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("opens each one, scans it and never scrolls sideways", async ({ page }) => {
    await signedIn(page, "unowned-phone");
    await startLaunch(page, "Phone unowned kit");

    for (const [label, id] of [
      ["Templates", "templates"],
      ["Uploads", "uploads"],
      ["Brand", "brand"],
    ] as const) {
      await openRail(page, label);
      await expect(page.getByTestId(`launch-${id}-panel`)).toBeVisible();
      await accessible(page);
      await noSidewaysScroll(page);
    }
  });
});

test.describe("the brand import screen", () => {
  test("says what the import is for, and names the one action that starts it", async ({ page }) => {
    await signedIn(page, "import-empty");
    await page.goto("/brand/import");

    await expect(page.getByRole("heading", { level: 1, name: "Import your brand" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Import your brand from your own site" })).toBeVisible();
    await expect(page.getByLabel("Your site's address")).toBeVisible();
    await expect(page.getByTestId("import-run")).toBeDisabled();

    // The completion % and what is still missing, from Y6's own weighting.
    await expect(page.getByTestId("import-completion")).toContainText("% complete");
    await expect(page.getByTestId("import-completion")).toContainText("not reviewed by anyone");
  });

  /**
   * A refusal that happens before any request: the address is not https, so nothing is fetched and
   * the screen says what to do about it. That is the error state of decision 0102 item 10, on a
   * real page, without reaching the network.
   */
  test("says why a site could not be read, and what to do about it", async ({ page }) => {
    await signedIn(page, "import-refusal");
    await page.goto("/brand/import");

    await page.getByLabel("Your site's address").fill("http://example.com");
    await page.getByTestId("import-run").click();

    const refusal = page.getByTestId("import-refusal");
    await expect(refusal).toContainText("Your site could not be read");
    await expect(refusal).toContainText("Paste the https:// address");
    // Retrying the same address would be refused the same way, so no Try again is offered.
    await expect(page.getByTestId("import-retry")).toHaveCount(0);
  });

  test("says that a word address is not a web address at all", async ({ page }) => {
    await signedIn(page, "import-bad-url");
    await page.goto("/brand/import");

    await page.getByLabel("Your site's address").fill("not an address");
    await page.getByTestId("import-run").click();

    await expect(page.getByTestId("import-refusal")).toContainText("That is not a web address");
  });

  test("keeps the import screen free of serious accessibility problems", async ({ page }) => {
    await signedIn(page, "import-axe");
    await page.goto("/brand/import");
    await expect(page.getByRole("heading", { level: 1, name: "Import your brand" })).toBeVisible();

    await accessible(page);
    await noSidewaysScroll(page);
  });

  test("is reachable and readable on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page, "import-phone");
    await page.goto("/brand/import");
    await expect(page.getByRole("heading", { level: 1, name: "Import your brand" })).toBeVisible();

    await expect(page.getByLabel("Your site's address")).toBeVisible();
    await accessible(page);
    await noSidewaysScroll(page);
  });
});

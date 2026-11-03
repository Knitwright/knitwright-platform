import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { accessible, settled } from "./chrome";
import { createAccount, signIn, test } from "./support";

/**
 * WAVE 2'S EDITOR PANELS, ON A SCREEN (code review v5, A7-A14).
 *
 * Seven panels were built against the editor's slot contract and the shell never built the props,
 * so every slot drew a labelled placeholder: Y3's Library toolbar and 2D pattern view, Y4's Specs
 * toolbar and tech pack view, Y5's Export panel, and Y8's Names & numbers and repeat maker, which
 * had no reference anywhere at all. Z1's inspiration board and Z2's Ask box were in the same state.
 * None of them had ever been opened in a browser or scanned by axe, which is exactly why nobody
 * noticed they were not mounted.
 *
 * So every one of them is opened here and asked to show its **own** content, and each surface is
 * scanned by axe at the browser tests' own desktop width and again at 390 x 844, with nothing
 * scrolling sideways. The panels' own rules are tested by their workstreams
 * (`e2e/editor-library-2d.spec.ts`, and each panel's own unit tests); what is proved here
 * is that they are on the page, and reachable, and that putting them there broke no contrast.
 *
 * Each test makes its own account and its own design name, so nothing it filters on can be another
 * run's row (plan v5, lesson 11). CI retries a failed browser test once.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // The session cookie arrives with the redirect: follow it before going anywhere else.
  await expect(page).toHaveURL(/\/studio$/);
};

/** A team jersey is the worked base article JSY-SS-01, so it drafts and has approved options. */
const startJersey = async (page: Page, label: string): Promise<string> => {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname;
};

const openToolbar = async (page: Page, label: "Form" | "Library" | "Specs"): Promise<void> => {
  const tab = page.getByRole("tablist", { name: "Toolbars" }).getByRole("tab", { name: label, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
};

const openView = async (page: Page, label: "2D" | "3D" | "Tech pack"): Promise<void> => {
  await page.getByTestId("view-toggle").getByRole("button", { name: label, exact: true }).click();
};

/**
 * Nothing scrolls sideways, at whatever width the test is running. Settled first: the entrance's
 * `scale(0.985)` pulls everything inward, so a real spill can measure as none while it plays
 * (#156). Its callers go through `accessible`, which settles too, but a measurement should not
 * depend on what was called before it.
 */
const noSidewaysScroll = async (page: Page, where: string): Promise<void> => {
  await settled(page);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sideways, `${where} scrolls the page sideways by this many pixels`).toBeLessThanOrEqual(1);
};

/**
 * Opens every newly mounted surface in turn and runs `work` on each with the panel on the page.
 * The order is the order a person meets them: the two toolbars, the two canvas views, the Export
 * panel and the Names & numbers panel.
 */
const eachPanel = async (page: Page, work: (where: string) => Promise<void>): Promise<void> => {
  await openToolbar(page, "Library");
  await expect(page.getByTestId("library-toolbar")).toBeVisible();
  // The board reads itself when it is mounted: wait for it to be up and for the first read to have
  // answered, so nothing scans or clicks a panel halfway through its first paint.
  const board = page.getByTestId("editor-inspiration");
  await expect(board.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(board.getByText("Reading the board.")).toHaveCount(0);
  await work("the Library toolbar");

  await openToolbar(page, "Specs");
  await expect(page.getByTestId("specs-toolbar")).toBeVisible();
  await work("the Specs toolbar");

  await openView(page, "2D");
  await expect(page.getByTestId("view-2d")).toBeVisible();
  await work("the 2D pattern view");

  await openView(page, "Tech pack");
  await expect(page.getByTestId("techpack-view")).toBeVisible();
  await work("the tech pack view");

  await page.getByTestId("export-button").click();
  await expect(page.getByTestId("editor-export-panel")).toBeVisible();
  await work("the Export panel");
  await page.getByTestId("export-button").click();

  await page.getByTestId("summary-empty-names-numbers").click();
  await expect(page.getByTestId("names-numbers-panel")).toBeVisible();
  await work("the Names & numbers panel");
  await page.getByTestId("side-panel-back").click();
};

test.describe("the panels the shell never mounted", () => {
  test("draws each one's own content where a placeholder used to be", async ({ page }) => {
    await signedIn(page, "panels-mounted");
    await startJersey(page, "Mounted kit");

    // Nothing anywhere draws `editor-slot-*` any more: the placeholder went with the last slot.
    await eachPanel(page, async () => {
      await expect(page.locator('[data-testid^="editor-slot-"]')).toHaveCount(0);
    });
  });

  /**
   * What the first browser run of this spec found, measured rather than clicked. Side by side, the
   * toggle's three tabs did not fit the rail's 4.75rem column: the strip overflowed into the panel
   * column, and the open panel -- later in the document, so above the overflow in the hit test --
   * swallowed every click meant for the Specs tab. A click only times out after a minute and blames
   * whichever panel is open; this says which tab is drawn outside its own strip.
   */
  test("keeps all three toolbar tabs inside their own strip, where a pointer can reach them", async ({ page }) => {
    await signedIn(page, "panels-tabs");
    await startJersey(page, "Tabs kit");

    // `kw-rise` starts at `scale(0.985)`, so a box measured while it plays is up to 1.5% small:
    // the strip and its tabs would both shrink and a real spill could measure as none, which is
    // what `headerFits` was doing until #156. Measure the settled page.
    await settled(page);
    const outside = await page.getByTestId("rail-segments").evaluate((strip) => {
      const edge = strip.getBoundingClientRect();
      const over = (tab: Element): boolean => {
        const box = tab.getBoundingClientRect();
        return box.left < edge.left - 1 || box.right > edge.right + 1;
      };
      return Array.from(strip.querySelectorAll('[role="tab"]'))
        .filter(over)
        .map((tab) => tab.textContent ?? "");
    });
    expect(outside, "these tabs are drawn outside the toggle, where whatever is beside it takes their clicks").toEqual([]);
  });

  test("gives the Library toolbar the repeat maker and the inspiration board under it", async ({ page }) => {
    await signedIn(page, "panels-library");
    await startJersey(page, "Library extras kit");
    await openToolbar(page, "Library");

    // Y8's repeat maker, with the spec's four repeat styles and its tile size in cm or in.
    const repeat = page.getByTestId("repeat-maker-panel");
    await expect(repeat).toBeVisible();
    await expect(repeat.getByTestId("repeat-style-full-drop")).toBeVisible();
    await expect(repeat.getByTestId("repeat-style-half-drop")).toBeVisible();
    await expect(repeat.getByTestId("repeat-style-brick")).toBeVisible();
    await expect(repeat.getByTestId("repeat-style-mirror")).toBeVisible();
    await expect(repeat.getByTestId("repeat-tile-size")).toBeVisible();

    // Z1's board, in the Inspiration slot Y3 left labelled for it.
    const board = page.getByTestId("editor-inspiration");
    await expect(board).toBeVisible();
    await expect(board.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.getByTestId("library-empty-inspiration-board")).toContainText("under this toolbar");
  });

  /**
   * Z2's Ask box, scoped to the design beside it. The answer path reaches the rulebook search and
   * the configured model, and Z2's own tests cover it; what is proved here is that the box is on
   * the design surface decision 0083 left it for and that it refuses an empty question in words.
   */
  test("puts the Ask box under the Specs toolbar, and refuses an empty question", async ({ page }) => {
    await signedIn(page, "panels-ask");
    await startJersey(page, "Ask kit");
    await openToolbar(page, "Specs");

    const ask = page.getByTestId("editor-ask");
    await expect(ask.getByRole("heading", { name: "Ask about this design" })).toBeVisible();
    await expect(ask.getByLabel("Your question")).toBeVisible();
    await expect(ask).toContainText("names the rule each sentence comes from");

    await ask.getByRole("button", { name: "Ask" }).click();
    await expect(ask).toContainText("Write your question.");
  });

  /**
   * The other half of F-S5 v2, which had no door at all (decision 0117 owner question 1, answered: a part
   * chooser beside the Ask box). `BestPracticeCard` and `bestPracticeAction` were built, tested and reachable
   * by nobody, so this is the first time either runs in a browser.
   *
   * What a part's card says depends on what the rulebook holds, which is a seeded table and not this test's to
   * assert. What is asserted is the door: six parts, exactly the six the action accepts, and a card that names
   * the part it is about and carries a rule id -- the rulebook's own best practice, or `R-GAP-000` saying
   * plainly that nothing is written for that part yet. Both are honest answers and the card has to be one.
   */
  test("puts the best-practice card behind a part chooser, beside the Ask box", async ({ page }) => {
    await signedIn(page, "panels-best-practice");
    await startJersey(page, "Best practice kit");
    await openToolbar(page, "Specs");

    const form = page.getByTestId("best-practice-form");
    await expect(page.getByRole("heading", { name: "What good looks like" })).toBeVisible();
    const parts = ["Collar and neck", "Sleeves", "Body", "Artwork and print", "Names and numbers", "Labels"];
    for (const part of parts) await expect(form.getByRole("button", { name: part, exact: true })).toBeVisible();
    await expect(form.getByRole("group")).toBeVisible();

    await form.getByRole("button", { name: "Artwork and print", exact: true }).click();
    const card = page.getByTestId("best-practice-result");
    await expect(card.getByRole("group", { name: "Best practice: Artwork and print" })).toBeVisible();
    await expect(card).toContainText("Best practice · Artwork and print");

    /*
     * AND WHAT IT SAYS TODAY IS THAT NOTHING IS WRITTEN FOR THIS PART.
     *
     * Every rule the rulebook migration seeds is `status = 'draft'` -- the four `'confirmed'`
     * strings in that file are its schema and its functions, not its rows -- and owner decision 11
     * keeps a draft's words from a member: `inForce` shows a member only a confirmed version. So a
     * member sees the gap line for all six parts until somebody confirms rules in `/admin/rulebook`.
     *
     * That is the honest answer and not a hole: `R-GAP-000` is the id for "no entry says this yet",
     * and the card carries its "Why?" so a person can read what the gap means. The assertion is
     * written as the two readings this card has -- the rulebook's own lines, each with its rule id,
     * or the gap line -- so confirming a print rule makes this test pass for the better reason
     * rather than needing a rewrite.
     */
    await expect(card).toContainText(/R-[A-Z]+-[0-9]{3}|has no best practice written for/);
    await expect(card.getByRole("button", { name: /^Why\? R-|^What this means$/ })).toBeVisible();

    // A second part replaces the first, so the card is never about two things at once.
    await form.getByRole("button", { name: "Labels", exact: true }).click();
    await expect(card.getByRole("group", { name: "Best practice: Labels" })).toBeVisible();
    await expect(card.getByRole("group", { name: "Best practice: Artwork and print" })).toHaveCount(0);
  });

  /**
   * Y5's panel, and the one thing the review said the route had to supply with it: the Excel
   * download. The gate is open for a fresh jersey — the drafter raises warnings, not blockers — and
   * the panel still says that the Review tab has not checked this version.
   */
  test("offers the tech pack's own files from the Export panel, Excel among them", async ({ page }) => {
    await signedIn(page, "panels-export");
    const path = await startJersey(page, "Export kit");
    await page.getByTestId("export-button").click();

    const panel = page.getByTestId("editor-export-panel");
    await expect(panel.getByRole("tablist", { name: "What to export" })).toBeVisible();
    await expect(panel.getByTestId("export-gate")).toContainText("has not checked this version yet");

    const projectId = path.split("/").pop();
    const excel = panel.getByTestId("export-output-xlsx");
    await expect(excel).toContainText("Excel");
    // The address the route really serves (`app/api/projects/[projectId]/exports/[format]`).
    await expect(excel).toHaveAttribute("href", new RegExp(`^/api/projects/${projectId}/exports/xlsx\\?version=1&colourway=`));

    // The production package has no download of its own, and says so instead of offering one.
    await panel.getByRole("tab", { name: /package/i }).click();
    await expect(panel.getByTestId("export-not-yet-kpp")).toContainText("no download for it here yet");
  });

  /** Y4's tech pack view on the canvas, with its tabs, its unit toggle and its provenance chips. */
  test("draws the tech pack view on the canvas with its tabs and units", async ({ page }) => {
    await signedIn(page, "panels-techpack");
    await startJersey(page, "Tech pack kit");
    await openView(page, "Tech pack");

    const view = page.getByTestId("techpack-view");
    await expect(view.getByRole("tablist", { name: "Tech pack tabs" })).toBeVisible();
    await expect(view.getByRole("radiogroup", { name: "Units" })).toBeVisible();
    await view.getByRole("radio", { name: "centimetres" }).check();
    await expect(view.getByRole("radio", { name: "centimetres" })).toBeChecked();

    await view.getByTestId("techpack-tab-measurements").click();
    await expect(view.getByTestId("techpack-tab-measurements")).toHaveAttribute("aria-selected", "true");
  });

  /** Y8's Names & numbers panel, which the Design Summary's own row opens in the right-hand panel. */
  test("opens Names & numbers from the Design Summary with its zones, fonts and preview", async ({ page }) => {
    await signedIn(page, "panels-names");
    await startJersey(page, "Names kit");

    await page.getByTestId("summary-empty-names-numbers").click();
    const panel = page.getByTestId("names-numbers-panel");
    await expect(panel.getByTestId("names-numbers-zones")).toBeVisible();
    await expect(panel.getByTestId("names-numbers-fonts")).toContainText("Placeholder list");
    await expect(panel.getByTestId("names-numbers-sample")).toBeVisible();
  });

  test("keeps every newly mounted panel free of serious accessibility problems", async ({ page }) => {
    await signedIn(page, "panels-axe");
    await startJersey(page, "Axe kit");

    await eachPanel(page, async (where) => {
      // The rail writes the address in a router transition, and axe reports `document-title`
      // against a page whose <title> that transition is still replacing. Wait for it to land.
      await expect(page).toHaveTitle(/\S/);
      await accessible(page);
      await noSidewaysScroll(page, where);
    });
  });
});

/** The same panels at phone width, where the shell stacks the rail, the canvas and the summary. */
test.describe("the editor panels on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("opens each one, scans it and never scrolls sideways", async ({ page }) => {
    await signedIn(page, "panels-phone");
    await startJersey(page, "Phone kit");

    await eachPanel(page, async (where) => {
      // The rail writes the address in a router transition, and axe reports `document-title`
      // against a page whose <title> that transition is still replacing. Wait for it to land.
      await expect(page).toHaveTitle(/\S/);
      await accessible(page);
      await noSidewaysScroll(page, where);
    });
  });
});

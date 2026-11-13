import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accessible } from "./chrome";
import { createAccount, openEditorPanel, signIn, test, userIdOf } from "./support";

/**
 * WAVE 4 WIRED, ON A SCREEN (decisions 0092, 0093, 0094, 0095 and 0096).
 *
 * Every one of these panels was built, tested against `panelDouble()` and then left unmounted,
 * because `components/launch/{RailPanels,Inspector,BoardCanvas}.tsx` are L1's files and five
 * workstreams needed the same two lines in one wave. So **none of them had ever been opened in a
 * browser or scanned by axe**, and that is what this file is for: each panel is opened, asked to
 * show its own content rather than a placeholder, and scanned at a desktop width and at 390 x 844.
 *
 * `launch-panels.spec.ts` beside it does the same for the panels no workstream owned (decision
 * 0108). The two files cover different panels and share only the way in.
 *
 * It also proves the one loop that crossed two workstreams: L2's renderer asks the shell to run a
 * mockup board, and the board comes back with a real file behind it.
 *
 * Each test makes its own account and its own launch name, so nothing it filters on can be another
 * run's row (plan v5, lesson 11). CI retries a failed browser test once.
 */

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // The session cookie arrives with the redirect: follow it before going anywhere else.
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

/** A launch project with nothing behind it, which is enough to open every panel. */
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

/** Adds a board from the inspector's Tools list and selects it, so its own panel is on screen. */
const addAndSelect = async (page: Page, kind: string, label: string): Promise<void> => {
  await page.getByTestId(`add-${kind}`).click();
  const board = page.getByRole("article", { name: `${label} board` });
  await expect(board).toBeVisible();
  await board.getByRole("button", { name: `Select ${label}` }).click();
};

test.describe("the rail panels L3 and L4 filled", () => {
  test("shows Text, Elements, Pattern fills, AI assistant and Layers, each with its own content", async ({ page }) => {
    await signedIn(page, "panels-rail");
    await startLaunch(page, "Rail panels kit");

    for (const [label, id] of [
      ["Text", "text"],
      ["Elements", "elements"],
      ["Pattern fills", "pattern-fills"],
      ["AI assistant", "assistant"],
      ["Layers", "layers"],
    ] as const) {
      await openRail(page, label);
      // The panel itself, and no placeholder anywhere near it.
      await expect(page.getByTestId(`marketing-panel-${id}`)).toBeVisible();
      await expect(page.getByTestId(`launch-panel-${id}`)).toHaveCount(0);
    }
  });

  test("shows L3's shoot ideas on the AI image panel", async ({ page }) => {
    await signedIn(page, "panels-shoots");
    await startLaunch(page, "Shoots panel kit");

    await openRail(page, "AI image");

    await expect(page.getByTestId("shoots-panel")).toBeVisible();
    await expect(page.getByTestId("launch-panel-ai-image")).toHaveCount(0);
  });

  test("says what each empty panel needs, and the Elements panel offers the shapes it draws", async ({ page }) => {
    await signedIn(page, "panels-empty");
    await startLaunch(page, "Empty panels kit");

    await openRail(page, "Text");
    await expect(page.getByTestId("marketing-empty-text")).toContainText("Add a marketing board");

    // The one action an empty panel offers really adds the board, and the panel then has fields.
    await page.getByTestId("marketing-action-text").click();
    await expect(page.getByRole("article", { name: "Marketing board" })).toBeVisible();

    await openRail(page, "Pattern fills");
    await expect(page.getByTestId("marketing-empty-pattern-fills")).toContainText("repeat print");
  });

  test("leaves only Likes holding a labelled placeholder", async ({ page }) => {
    await signedIn(page, "panels-placeholders");
    await startLaunch(page, "Placeholder kit");

    // One panel of the rail is left: nothing in the platform records a like (decision 0108's own
    // owner question). `components/launch/panel-mounting.test.ts` holds the same one against the
    // maps, so the two cannot disagree about what is still to come.
    await openRail(page, "Likes");
    await expect(page.getByTestId("launch-panel-likes")).toContainText("workstream L8");

    for (const label of ["Templates", "Uploads", "Brand"] as const) {
      await openRail(page, label);
      await expect(page.getByTestId(`launch-panel-${label.toLowerCase()}`)).toHaveCount(0);
    }
  });
});

test.describe("the board panels L3, L4, L5 and L6 filled", () => {
  test("opens the AI image board's own panel, with the cost in the button's own words", async ({ page }) => {
    await signedIn(page, "panels-ai-image-board");
    await startLaunch(page, "AI image board kit");
    await addAndSelect(page, "ai_image", "AI image");

    await expect(page.getByTestId("ai-image-panel")).toBeVisible();
    await expect(page.getByTestId("launch-panel-board-ai-image")).toHaveCount(0);
  });

  /**
   * Flatten, Upscale and Reframe (spec F-L4). The contextual task bar has offered these three since
   * L6 and handed them to "the board's own panel" -- and that panel, `components/flows/BoardActions
   * .tsx`, was mounted nowhere, which decision 0124 reported and 0127 closes. This is the first time
   * any of the three is drawn in a browser.
   *
   * Nothing is pressed. A fresh board has not been run, so all three are refused with the one thing
   * to do, and that refusal is what this asserts: pressing an operation that *is* allowed starts a
   * real run, which is a paid call and never a test's to make.
   */
  test("offers a board's own Flatten, Upscale and Reframe, each saying why it is off", async ({ page }) => {
    await signedIn(page, "panels-board-actions");
    await startLaunch(page, "Board actions kit");
    await addAndSelect(page, "ai_image", "AI image");

    const actions = page.getByTestId("flow-board-actions");
    await expect(actions.getByRole("heading", { name: "This board" })).toBeVisible();
    for (const id of ["flatten", "upscale", "reframe"]) {
      await expect(actions.getByTestId(`flow-op-${id}`)).toBeVisible();
      await expect(actions.getByTestId(`flow-op-${id}`)).toBeDisabled();
    }
    await expect(actions).toContainText("Run this board first");

    // Upscale's own choice of how much bigger is there whether or not Upscale can be used.
    await expect(actions.getByRole("group", { name: "How much bigger" })).toBeAttached();
    await expect(actions.getByTestId("flow-upscale-2")).toHaveAttribute("aria-pressed", "true");

    await accessible(page);
  });

  test("opens the marketing board's own panel, with its layouts", async ({ page }) => {
    await signedIn(page, "panels-marketing-board");
    await startLaunch(page, "Marketing board kit");
    await addAndSelect(page, "marketing", "Marketing");

    await expect(page.getByTestId("marketing-panel-board-marketing")).toBeVisible();
    await expect(page.getByTestId("launch-panel-board-marketing")).toHaveCount(0);
    await expect(page.getByTestId("marketing-templates")).toBeVisible();
  });

  test("opens the AI video board's own panel, which asks for a first frame before anything else", async ({ page }) => {
    await signedIn(page, "panels-video-board");
    await startLaunch(page, "Video board kit");
    await addAndSelect(page, "ai_video", "AI video");

    await expect(page.getByTestId("video-panel")).toBeVisible();
    await expect(page.getByTestId("launch-panel-board-ai-video")).toHaveCount(0);
    // A clip starts from the garment the platform drew, so a board with no design behind it says
    // that in L5's own words rather than showing a model picker it cannot honour (decision 0095).
    await expect(page.getByTestId("video-empty")).toContainText("No design behind this board");
    await expect(page.getByTestId("video-models")).toHaveCount(0);
  });

  test("opens the info card's own panel, which says how much of the garment's data is missing", async ({ page }) => {
    await signedIn(page, "panels-info-card");
    await startLaunch(page, "Info card kit");
    await addAndSelect(page, "info_card", "Info card");

    await expect(page.getByTestId("launch-panel-board-info-card")).toBeVisible();
    await expect(page.getByTestId("info-card-note")).toBeVisible();
  });

  test("shows the run summary of the whole canvas, with what a run would cost", async ({ page }) => {
    await signedIn(page, "panels-run-summary");
    await startLaunch(page, "Run summary kit");

    // The summary is about the canvas, not one board, so it shows with nothing selected -- and only
    // once there is something to run.
    await expect(page.getByTestId("launch-panel-flow-run")).toHaveCount(0);
    await page.getByTestId("launch-empty-action").click();
    await expect(page.getByRole("article", { name: "Design board" })).toBeVisible();

    await expect(page.getByTestId("launch-panel-flow-run")).toBeVisible();
    await expect(page.getByTestId("flow-run-all")).toBeVisible();
  });
});

test.describe("L2's renderer, end to end", () => {
  test("draws a mockup board from the design behind it and leaves a real file on it", async ({ page }) => {
    // A design, a launch, a scene and a real render with sharp: more steps than one minute allows.
    test.setTimeout(180_000);
    const email = await createAccount("panels-render");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/projects\/recent$/);

    // A design to launch. The mockup is drawn from this design's own flat drawing.
    const designName = `Render kit ${randomUUID().slice(0, 8)}`;
    await page.goto("/studio/new");
    await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
    await page.getByLabel("Made for").selectOption({ label: "Women" });
    await page.getByLabel("Design name").fill(designName);
    await page.getByRole("button", { name: "Create design" }).click();
    await expect(page.getByRole("heading", { level: 1, name: designName })).toBeVisible();

    const launchName = `Render launch ${randomUUID().slice(0, 8)}`;
    await page.goto("/launch");
    await page.getByLabel("Name this launch").fill(launchName);
    await page.getByLabel("Design to launch").selectOption({ label: `${designName} (version 1)` });
    await page.getByRole("button", { name: "Start the launch" }).click();
    await expect(page.getByRole("heading", { level: 1, name: launchName })).toBeVisible();
    // The Design board is put on the canvas with the launch, so the garment is locked at once.
    await expect(page.getByRole("article", { name: "Design board" })).toBeVisible();

    // A mockup board fed by it, then the scene on that board: the library adds the board first and
    // sets the scene on the second press, because `addBoard` hands no id back (decision 0092).
    await openEditorPanel(page, "Mockups");
    await page.getByTestId("mockup-use-product-front").click();
    const board = page.getByRole("article", { name: "Mockup board" });
    await expect(board).toBeVisible();
    await board.getByRole("button", { name: "Select Mockup" }).click();
    await openEditorPanel(page, "Mockups");
    await page.getByTestId("mockup-use-product-front").click();
    await expect(page.getByTestId("mockup-board-scene")).toHaveText("Front render");

    // Before the run there is nothing to bake into a picture.
    await expect(page.getByTestId("mockup-board-convert")).toBeDisabled();

    await page.getByTestId("mockup-board-render").click();

    // Drawing is sharp on the server: the board comes back ready, and the picture it holds is what
    // Convert to image needs, so that button is no longer refused.
    await expect(board).toContainText("Ready", { timeout: 40_000 });
    await expect(page.getByTestId("mockup-board-convert")).toBeEnabled();

    // And the file is real: a `files` row of the brand, with bytes in it.
    const userId = await userIdOf(email);
    const membership = await admin().from("memberships").select("brand_id").eq("user_id", userId).single();
    const brandId = (membership.data as { brand_id: string }).brand_id;
    const boards = await admin().from("boards").select("output_file_id, output_role, status").eq("brand_id", brandId).eq("kind", "mockup");
    const row = (boards.data as { output_file_id: string | null; output_role: string; status: string }[])[0];
    expect(row?.status).toBe("ready");
    // A drawn mockup is an asset, which is the one role the garment lock allows a board's output.
    expect(row?.output_role).toBe("asset");
    expect(row?.output_file_id).toBeTruthy();

    const file = await admin().from("files").select("kind, content_type, bytes").eq("id", row?.output_file_id ?? "").single();
    const stored = file.data as { kind: string; content_type: string; bytes: number };
    expect(stored.kind).toBe("render");
    expect(stored.content_type).toMatch(/^image\//);
    expect(stored.bytes).toBeGreaterThan(1000);
  });

  test("refuses to draw a mockup board with no design behind it, and says why", async ({ page }) => {
    await signedIn(page, "panels-render-locked");
    await startLaunch(page, "Locked render kit");

    await page.getByTestId("add-mockup").click();
    await page.getByRole("article", { name: "Mockup board" }).getByRole("button", { name: "Select Mockup" }).click();
    await openEditorPanel(page, "Mockups");
    await page.getByTestId("mockup-use-flat-lay-white").click();

    await page.getByTestId("mockup-board-render").click();

    await expect(page.getByTestId("launch-note")).toContainText("Connect a board into this Mockup board first");
  });
});

/**
 * The axe scan of every panel, at a desktop width and at 390 x 844. Ten scans in one test: a fresh
 * account and a fresh launch project for each panel would be ten sign-ins, and the scan is of the
 * panel rather than of the way in.
 *
 * `accessible` is the shared helper (`e2e/chrome.ts`): it waits for the entrance animations to
 * finish, because text still fading in fails the contrast check for a moment, and it names the
 * element and its colours when something fails.
 */
test.describe("accessibility of the panels, at both widths", () => {
  /** Puts a board of each newly mounted kind on the canvas, while nothing is selected. */
  const addBoards = async (page: Page): Promise<void> => {
    for (const [kind, label] of [
      ["ai_image", "AI image"],
      ["marketing", "Marketing"],
      ["ai_video", "AI video"],
      ["info_card", "Info card"],
    ] as const) {
      await page.getByTestId(`add-${kind}`).click();
      await expect(page.getByRole("article", { name: `${label} board` })).toBeVisible();
    }
  };

  /** Opens each newly mounted panel in turn and scans the page with each one open. */
  const scanEveryPanel = async (page: Page): Promise<void> => {
    for (const label of ["Text", "Elements", "Pattern fills", "AI assistant", "Layers", "AI image", "Mockups", "Photos"]) {
      await openRail(page, label);
      await accessible(page);
    }
    await addBoards(page);
    // The run summary shows with nothing selected, so it is scanned before anything is.
    await expect(page.getByTestId("launch-panel-flow-run")).toBeVisible();
    await accessible(page);
    for (const label of ["AI image", "Marketing", "AI video", "Info card"]) {
      await page.getByRole("article", { name: `${label} board` }).getByRole("button", { name: `Select ${label}` }).click();
      await expect(page.getByTestId("launch-inspector")).toContainText(label);
      await accessible(page);
    }
  };

  test("keeps every panel free of serious problems at a desktop width", async ({ page }) => {
    test.setTimeout(180_000);
    await signedIn(page, "panels-axe");
    await startLaunch(page, "Axe panels kit");

    await scanEveryPanel(page);
    await expect(page.getByTestId("launch-shell").getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("keeps every panel free of serious problems on a phone, and never scrolls sideways", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page, "panels-axe-phone");
    await startLaunch(page, "Axe phone panels kit");

    await scanEveryPanel(page);

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways, "the launch shell scrolls sideways on a phone by this many pixels").toBeLessThanOrEqual(1);
  });
});

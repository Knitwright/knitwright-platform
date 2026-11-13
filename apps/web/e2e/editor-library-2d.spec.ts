import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * Plan v5 Y3 (spec F-S4, decision 0076): the 2D pattern view and the Library toolbar.
 *
 * Both are **slot panels**, and both are mounted: the shell makes `EditorSlotProps` and draws each
 * one where it drew a labelled placeholder (code review v5, A7 and A8). Every test below used to
 * skip itself with that as the reason; they run as they were written, against the real route and
 * the real database, now the shell gives them their props.
 *
 * Each test makes its own account and its own design name, so nothing it filters on can be another
 * run's row (plan v5, lesson 11).
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // The session cookie arrives with the redirect: follow it before going anywhere else.
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

const startJersey = async (page: Page, label: string): Promise<string> => {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  // The design's own address: it opens the editor on the one canvas (decision 0145), and its pages sit under it.
  return new URL(page.url()).pathname.replace("/project/", "/studio/");
};

/** Opens the Library toolbar, by the one tablist the shell gives the three toolbars. */
const openLibrary = async (page: Page): Promise<void> => {
  await page.getByRole("tablist", { name: "Toolbars" }).getByRole("tab", { name: "Library" }).click();
};

/**
 * Puts the 2D view on the canvas. A team jersey is an article the drafter can draw, so the editor
 * opens such a design in 3D (`editorPageState`, plan v5 Y2): without this the canvas holds the 3D
 * view and the `view-2d` slot is not on the page at all, placeholder or panel.
 */
const open2d = async (page: Page): Promise<void> => {
  await page.getByTestId("view-toggle").getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.getByRole("region", { name: "2D pattern view" })).toBeVisible();
};

/** Opens a section of the toolbar: each is a <details> whose <summary> carries its name and count. */
const openSection = async (page: Page, id: string): Promise<void> => {
  await page.getByTestId("library-toolbar").getByTestId(`library-section-${id}`).locator("summary").click();
};

test.describe("the Library toolbar", () => {
  test("shows the Knitwright library, Your library and Inspiration, and applies a fabric to every panel", async ({ page }) => {
    await signedIn(page, "library-apply");
    await startJersey(page, "Library kit");
    await openLibrary(page);

    const toolbar = page.getByTestId("library-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole("heading", { name: "Knitwright library" })).toBeVisible();
    await expect(toolbar.getByRole("heading", { name: "Your library" })).toBeVisible();
    await expect(toolbar.getByRole("heading", { name: "Inspiration" })).toBeVisible();

    // The fabrics are the base article's own approved list, with their spec cards.
    await openSection(page, "kw-fabrics");
    const fabric = toolbar.getByTestId("library-item-fabric-F-POLY-INT");
    await expect(fabric).toContainText("100% polyester interlock");
    await fabric.getByRole("button", { name: /F-POLY-INT/ }).click();
    await expect(page.getByTestId("library-said")).toContainText("on every panel");
    await expect(page.getByTestId("design-summary")).toContainText("F-POLY-INT");
  });

  test("says why Your library and the Pantone search are not available, rather than showing an invented list", async ({ page }) => {
    await signedIn(page, "library-ports");
    await startJersey(page, "Ports kit");
    await openLibrary(page);

    await expect(page.getByTestId("library-empty-yours-brand-kit")).toContainText("not on the editor's slot contract yet");
    await expect(page.getByTestId("library-empty-kw-graphics")).toContainText("no graphics library on file yet");
    await expect(page.getByTestId("library-section-kw-colours")).toContainText("licensed");
    await expect(page.getByTestId("library-empty-inspiration-board")).toContainText("inspiration board");
  });

  test("puts a pattern fill on the body and offers only the settings the design can store", async ({ page }) => {
    await signedIn(page, "library-fill");
    await startJersey(page, "Fill kit");
    await openLibrary(page);

    const toolbar = page.getByTestId("library-toolbar");
    // The section's own <summary>. `getByText("Colours")` matches the nineteen swatch buttons under
    // it as well, which nothing noticed while these tests skipped themselves.
    await openSection(page, "kw-colours");
    await toolbar.getByTestId("library-item-colour-classic-navy").getByRole("button", { name: /Navy/ }).click();
    await expect(page.getByTestId("library-said")).toContainText("every panel");

    await openSection(page, "kw-pattern-fills");
    await toolbar.getByTestId("library-item-fill-kit-hoops-classic").getByRole("button", { name: /Hoops/ }).click();

    const popover = page.getByTestId("pattern-fill");
    await expect(popover).toContainText("Hoops");
    await expect(popover.getByTestId("pattern-fill-bandWidthMm")).toBeVisible();
    // Height, padding and rotation are listed as things a design cannot store, not drawn as sliders.
    await expect(popover).toContainText("Rotation:");
    await expect(popover.getByTestId("pattern-fill-rotationDeg")).toHaveCount(0);
    await expect(popover.getByRole("button", { name: "Delete the pattern fill" })).toBeVisible();
  });
});

test.describe("the 2D pattern view", () => {
  test("draws the drafted pieces with their lines named, and a 100 mm scale bar", async ({ page }) => {
    await signedIn(page, "view2d-draw");
    await startJersey(page, "Sheet kit");
    await open2d(page);

    const view = page.getByTestId("view-2d");
    await expect(view).toBeVisible();
    await expect(view.getByTestId("view-2d-hint")).toHaveText("Click to apply to all or drag to apply to one panel");
    // fabric.js draws two stacked canvases, a lower and an upper; the drawing is on the lower one.
    await expect(view.getByTestId("pattern-canvas").locator("canvas").first()).toBeVisible();
    await expect(view.getByTestId("view-2d-ruler")).toBeVisible();

    const legend = view.getByTestId("view-2d-legend");
    await expect(legend).toContainText("Cut line");
    await expect(legend).toContainText("Bleed");
    await expect(legend).toContainText("Safe zone");
    await expect(legend).toContainText("100 mm");
    await expect(legend.getByRole("button", { name: "Why?" }).first()).toBeVisible();
    await expect(view.getByTestId("view-2d-pieces").getByRole("listitem").first()).toContainText("mm");
  });

  test("opens the rule behind the bleed line", async ({ page }) => {
    await signedIn(page, "view2d-why");
    await startJersey(page, "Why kit");
    await open2d(page);

    await page.getByTestId("view-2d-legend").getByRole("button", { name: "Why?" }).first().click();
    await expect(page.getByTestId("why-panel")).toBeVisible();
  });
});

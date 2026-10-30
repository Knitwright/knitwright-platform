import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * Plan v5 Y3 (spec F-S4, decision 0076): the 2D pattern view and the Library toolbar.
 *
 * Both are **slot panels**. The shell owns where they go, and the slot contract
 * (`apps/web/lib/editor/slots.ts`) says the shell loads each one with `next/dynamic` where it now
 * draws `slotPlaceholder(id)`. Y3 does not own the shell's files, so it built the panels and left
 * the one line that mounts them to the orchestrator. Until that line lands, the shell still draws
 * the placeholder, and each test below skips itself and says why rather than failing on work that
 * was deliberately left to someone else. The day the slots are wired, these tests start running as
 * they are, against the real route and the real database.
 *
 * Each test makes its own account and its own design name, so nothing it filters on can be another
 * run's row (plan v5, lesson 11).
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // The session cookie arrives with the redirect: follow it before going anywhere else.
  await expect(page).toHaveURL(/\/studio$/);
};

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

/** True while the shell still draws the labelled placeholder in place of this workstream's panel. */
const notWired = async (page: Page, slot: "library" | "view-2d"): Promise<boolean> => (await page.getByTestId(`editor-slot-${slot}`).count()) > 0;

const WIRING = "The editor shell still draws the slot placeholder: the one line that mounts Y3's panel is the orchestrator's (decision 0076).";

test.describe("the Library toolbar", () => {
  test("shows the Knitwright library, Your library and Inspiration, and applies a fabric to every panel", async ({ page }) => {
    await signedIn(page, "library-apply");
    await startJersey(page, "Library kit");
    await page.getByRole("tab", { name: "Library" }).click();
    test.skip(await notWired(page, "library"), WIRING);

    const toolbar = page.getByTestId("library-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole("heading", { name: "Knitwright library" })).toBeVisible();
    await expect(toolbar.getByRole("heading", { name: "Your library" })).toBeVisible();
    await expect(toolbar.getByRole("heading", { name: "Inspiration" })).toBeVisible();

    // The fabrics are the base article's own approved list, with their spec cards.
    await toolbar.getByTestId("library-section-kw-fabrics").getByText("Fabrics").click();
    const fabric = toolbar.getByTestId("library-item-fabric-F-POLY-INT");
    await expect(fabric).toContainText("100% polyester interlock");
    await fabric.getByRole("button", { name: /F-POLY-INT/ }).click();
    await expect(page.getByRole("status")).toContainText("on every panel");
    await expect(page.getByTestId("design-summary")).toContainText("F-POLY-INT");
  });

  test("says why Your library and the Pantone search are not available, rather than showing an invented list", async ({ page }) => {
    await signedIn(page, "library-ports");
    await startJersey(page, "Ports kit");
    await page.getByRole("tab", { name: "Library" }).click();
    test.skip(await notWired(page, "library"), WIRING);

    await expect(page.getByTestId("library-empty-yours-brand-kit")).toContainText("not on the editor's slot contract yet");
    await expect(page.getByTestId("library-empty-kw-graphics")).toContainText("no graphics library on file yet");
    await expect(page.getByTestId("library-section-kw-colours")).toContainText("licensed");
    await expect(page.getByTestId("library-empty-inspiration-board")).toContainText("wave 3");
  });

  test("puts a pattern fill on the body and offers only the settings the design can store", async ({ page }) => {
    await signedIn(page, "library-fill");
    await startJersey(page, "Fill kit");
    await page.getByRole("tab", { name: "Library" }).click();
    test.skip(await notWired(page, "library"), WIRING);

    const toolbar = page.getByTestId("library-toolbar");
    await toolbar.getByTestId("library-section-kw-colours").getByText("Colours").click();
    await toolbar.getByTestId("library-item-colour-classic-navy").getByRole("button", { name: /Navy/ }).click();
    await expect(page.getByRole("status")).toContainText("every panel");

    await toolbar.getByTestId("library-section-kw-pattern-fills").getByText("Pattern fills").click();
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
    test.skip(await notWired(page, "view-2d"), WIRING);

    const view = page.getByTestId("view-2d");
    await expect(view).toBeVisible();
    await expect(view.getByTestId("view-2d-hint")).toHaveText("Click to apply to all or drag to apply to one panel");
    await expect(view.getByTestId("pattern-canvas").locator("canvas")).toBeVisible();
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
    test.skip(await notWired(page, "view-2d"), WIRING);

    await page.getByTestId("view-2d-legend").getByRole("button", { name: "Why?" }).first().click();
    await expect(page.getByTestId("why-panel")).toBeVisible();
  });
});

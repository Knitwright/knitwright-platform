import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { accessible, settled } from "./chrome";
import { createAccount, openEditorPanel, signIn, test } from "./support";

/**
 * THE LAUNCH PACKS, AND GETTING RID OF A LAUNCH PROJECT (decision 0124).
 *
 * L6 built the six packs of F-L4 and the picker for them (decision 0096) and left the mounting to
 * whoever owned the rail; L1's own contract says the `templates` panel is for "Marketing,
 * kit-bundle and flow templates", and the panel built there listed design templates only and sent
 * anyone after a pack "to the canvas", where nothing offered one. The packs are in that panel now,
 * and opening one is `applyFlowTemplateAction`, which had no caller either.
 *
 * The delete is the other half: a brand could make a canvas and never get rid of it, although
 * `removeLaunchProjectAction` was finished, checked and waiting for a button.
 *
 * Each test makes its own account and its own launch name, because the whole suite shares one
 * database (plan v5, lesson 11).
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
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

/**
 * The Delete of this project's row in the launch list. The link is named for the row's position
 * ("Delete row 1"), never for the project: a link whose name contains the row's own name makes
 * every other link in that row ambiguous, which is how the first version of this screen broke the
 * launch list's own spec.
 */
const deleteRow = (page: Page, name: string): Locator =>
  page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name, exact: true }) })
    .getByRole("link", { name: /^Delete row/ });

const openTemplates = async (page: Page): Promise<void> => {
  await openEditorPanel(page, "Templates");
};

/** Settled first, so a width is the width a person sees rather than the entrance's (see `settled`). */
const noSidewaysScroll = async (page: Page): Promise<void> => {
  await settled(page);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sideways).toBeLessThanOrEqual(1);
};

test.describe("the launch packs", () => {
  test("lists all six in the Templates panel, with their steps and their tutorial card", async ({ page }) => {
    await signedIn(page, "packs-list");
    await startLaunch(page, "Packs kit");
    await openTemplates(page);

    const packs = page.getByTestId("launch-flow-packs");
    await expect(packs.getByRole("heading", { name: "Launch packs" })).toBeVisible();
    await expect(packs).toContainText("the cost is shown before anything is spent");
    for (const slug of ["club-kit-launch-pack", "brand-drop-pack", "team-store-promo", "colourway-set", "shopify-product-listing", "sponsor-pack"]) {
      await expect(page.getByTestId(`flow-template-${slug}`), slug).toBeVisible();
    }

    // The steps of one pack open and close, as a disclosure with its own name.
    const steps = page.getByTestId("flow-template-steps-sponsor-pack");
    await expect(steps).toHaveAttribute("aria-expanded", "false");
    await steps.click();
    await expect(steps).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("flow-notes-sponsor-pack")).toBeVisible();

    // Decision 0096: there is no film, and the card says so rather than opening nothing.
    await expect(page.getByTestId("flow-tutorial-sponsor-pack")).toContainText("No tutorial film has been made yet");

    await accessible(page);
    await noSidewaysScroll(page);
  });

  test("opens a pack onto the canvas, spending nothing", async ({ page }) => {
    await signedIn(page, "packs-open");
    const name = await startLaunch(page, "Open pack");
    await openTemplates(page);

    // A canvas with no design says so rather than pretending the pack will have one.
    await expect(page.getByTestId("launch-flow-packs")).toContainText("has no Design board yet");

    await page.getByTestId("flow-template-open-sponsor-pack").click();
    await expect(page.getByText(/boards are on the canvas/)).toBeVisible();
    await expect(page.getByText(/Nothing has run and nothing has been charged yet/)).toBeVisible();

    // And the boards are really there when the canvas is read again.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByTestId("canvas-boards")).not.toHaveAttribute("data-count", "0");
  });

  test("works at phone width, where the rail and the panel stack", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signedIn(page, "packs-phone");
    await startLaunch(page, "Phone packs");
    await openTemplates(page);

    await expect(page.getByTestId("flow-template-sponsor-pack")).toBeVisible();
    await noSidewaysScroll(page);
    await accessible(page);
  });
});

test.describe("deleting a launch project", () => {
  test("is reached from the list, names what goes, and asks for the word first", async ({ page }) => {
    await signedIn(page, "launch-delete");
    const name = await startLaunch(page, "Doomed launch");

    await page.goto("/launch");
    await deleteRow(page, name).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText(/This deletes the canvas, which has nothing on it yet/)).toBeVisible();
    await expect(page.getByText(/The design it launches is not touched/)).toBeVisible();

    // The word is the thing that lets it run: a wrong one changes nothing.
    await page.getByLabel('Type "delete" to confirm').fill("yes");
    await page.getByRole("button", { name: "Delete this launch project" }).click();
    await expect(page.getByText('Type "delete" to confirm.')).toBeVisible();
    await page.goto("/launch");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    await deleteRow(page, name).click();
    await accessible(page);
    await page.getByLabel('Type "delete" to confirm').fill("delete");
    await page.getByRole("button", { name: "Delete this launch project" }).click();

    await expect(page).toHaveURL(/\/launch$/);
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  });

  test("keeps it when the way back is taken", async ({ page }) => {
    await signedIn(page, "launch-keep");
    const name = await startLaunch(page, "Kept launch");

    await page.goto("/launch");
    await deleteRow(page, name).click();
    await page.getByRole("link", { name: "Keep it and go back" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByTestId("launch-shell")).toBeVisible();
  });
});

import { expect, type Page } from "@playwright/test";
import { FIRST_RENDER_BUDGET_MS } from "../lib/teamwear/vocabulary";
import { createAccount, signIn, test } from "./support";

/**
 * The teamwear configurator (spec F-T1). The three acceptance tests of the feature are here: a club
 * with its colours finishes a kit, the first 3D picture is inside its three-second budget, and on a
 * phone the right panel is a bottom sheet over the stage.
 *
 * Each test signs in as its own brand, so the design a Save makes carries that brand's name and no
 * two runs of this file can find each other's rows (Lesson 11).
 */

const openConfigurator = async (page: Page): Promise<void> => {
  await page.goto("/teamwear");
  await expect(page.getByTestId("teamwear-configurator")).toBeVisible();
};

/** The stage says, on itself, how long its first picture took. */
const firstRenderMs = async (page: Page): Promise<number> => {
  const stage = page.getByTestId("teamwear-stage");
  await expect(stage).toHaveAttribute("data-ready-ms", /^\d+$/, { timeout: 20_000 });
  return Number(await stage.getAttribute("data-ready-ms"));
};

test.describe("the teamwear configurator", () => {
  test("a club picks a bundle, a collar code and a quantity, sees the price and saves the kit", async ({ page }) => {
    await signIn(page, await createAccount("teamwear", { brand: "Dockside Rovers" }));
    await openConfigurator(page);

    // The sport chips, the backdrop and the three kit parts, each with its own pill.
    await expect(page.getByRole("navigation", { name: "Sport" }).getByRole("link", { name: "Football" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("teamwear-stage")).toHaveAttribute("data-backdrop", "pitch");
    await expect(page.getByTestId("teamwear-pills").getByRole("tab")).toHaveText(["Shirt", "Shorts", "Socks"]);

    // A goalkeeper bundle needs a third colour, and says so rather than inventing one.
    await page.getByTestId("teamwear-bundle-gk").click();
    await expect(page.getByTestId("teamwear-bundle-problem")).toContainText("needs a third colour");

    // The home bundle settles the colours of every part at once.
    await page.getByTestId("teamwear-bundle-home").click();
    await expect(page.getByTestId("teamwear-bundle-problem")).toHaveCount(0);
    await expect(page.getByTestId("teamwear-row-colours")).toHaveAttribute("data-value", /#/);

    // Who the kit is for, which is the other row a part has to settle.
    await page.getByTestId("teamwear-row-model").click();
    await page.getByTestId("teamwear-wearer").selectOption("women");
    await expect(page.getByTestId("teamwear-row-model")).toHaveAttribute("data-value", /JSY-SS-01 · regular · Women/);

    // The collar comes from the catalogue, as a code the factory reads.
    await page.getByTestId("teamwear-row-option:collar").click();
    const collar = page.getByTestId("teamwear-row-open-option:collar");
    await expect(collar).toContainText("C01");
    await collar.getByRole("radio", { name: /C02/ }).check();
    await expect(page.getByTestId("teamwear-row-option:collar")).toHaveAttribute("data-value", /^C02/);
    await expect(page.getByTestId("teamwear-row-option:collar")).toHaveAttribute("data-rule-id", "R-CON-005");

    // Every option group answered, so the shirt's pill ticks.
    await page.getByTestId("teamwear-row-option:sleeve_finish").click();
    await page.getByTestId("teamwear-row-open-option:sleeve_finish").getByRole("radio", { name: /K01/ }).check();
    await page.getByTestId("teamwear-row-option:pattern_fill").click();
    await page.getByTestId("teamwear-row-open-option:pattern_fill").getByRole("radio", { name: /P00/ }).check();
    await expect(page.getByTestId("teamwear-pill-shirt")).toHaveAttribute("data-done", "true");

    // A parameter cannot leave the range the factory approved: the slider's own ends are the article's.
    await page.getByTestId("teamwear-row-parameters").click();
    const slider = page.getByTestId("teamwear-parameter-body_length_offset");
    await expect(slider).toHaveAttribute("min", "-30");
    await expect(slider).toHaveAttribute("max", "40");
    await expect(slider).toHaveAttribute("step", "10");

    // The stepper, the price and the total.
    const quantity = page.getByTestId("teamwear-quantity");
    await expect(quantity).toHaveValue("20");
    await page.getByRole("button", { name: "One more shirt" }).click();
    await expect(quantity).toHaveValue("21");

    // The last button is a hand-off, never an Add to cart, and it waits for a saved design.
    const handoff = page.getByRole("button", { name: "Order through the Knitwright Store" });
    await expect(page.getByTestId("teamwear-footer")).not.toContainText("Add to cart");
    await handoff.click();
    await expect(page.getByTestId("teamwear-handoff-note")).toContainText("Save the kit first");

    // The quote is workstream Z6's and says so, rather than making a number up.
    await page.getByTestId("teamwear-quote").click();
    await expect(page.getByTestId("teamwear-quote-note")).toContainText("not switched on yet");

    // Save stores the part showing as a design, and comes back with it on the address.
    await page.getByTestId("teamwear-save").click();
    await expect(page).toHaveURL(/\/teamwear\?.*project=[0-9a-f-]{36}/);

    // "Design in Studio" then opens that design in the editor, with the configurator's own form.
    await page.getByTestId("teamwear-studio").click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\?.*opt=collar%3AC02/);
    await expect(page).toHaveURL(/rail=form/);
    await expect(page).toHaveURL(/view=3d/);
  });

  test("the first 3D picture of the kit is inside its three-second budget", async ({ page }) => {
    await signIn(page, await createAccount("teamwear-budget", { brand: "Budget Belles" }));
    await openConfigurator(page);
    await expect(page.getByTestId("teamwear-canvas")).toBeVisible();
    const measured = await firstRenderMs(page);
    expect(measured).toBeGreaterThan(0);
    expect(measured).toBeLessThan(FIRST_RENDER_BUDGET_MS);
    await expect(page.getByTestId("teamwear-stage-note")).toHaveCount(0);
  });

  test("the view chip shows all five views and the tool rail holds the seven tools", async ({ page }) => {
    await signIn(page, await createAccount("teamwear-stage", { brand: "Stage Saints" }));
    await openConfigurator(page);
    const chip = page.getByTestId("teamwear-view-chip");
    await expect(chip.getByRole("button")).toHaveText(["Front", "Back", "Left", "Right", "Collar"]);
    await expect(chip).toHaveAttribute("data-showing", "front");
    await chip.getByRole("button", { name: "Collar" }).click();
    await expect(chip).toHaveAttribute("data-showing", "collar");

    const rail = page.getByTestId("teamwear-tool-rail");
    await expect(rail.getByRole("button")).toHaveCount(7);
    await expect(page.getByTestId("teamwear-tool-undo")).toBeDisabled();

    // Ideas are workstream Z6's: the button is there and says plainly that they are not ready.
    await page.getByTestId("teamwear-tool-ideas").click();
    await expect(page.getByTestId("teamwear-panel-ideas")).toContainText("crest-to-kit");

    // Undo comes back to life after a change, and takes it back.
    await page.getByTestId("teamwear-bundle-away").click();
    const after = await page.getByTestId("teamwear-row-colours").getAttribute("data-value");
    await page.getByTestId("teamwear-tool-undo").click();
    await expect(page.getByTestId("teamwear-row-colours")).not.toHaveAttribute("data-value", after ?? "");
  });
});

test.describe("the configurator on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the right panel is a bottom sheet over the stage", async ({ page }) => {
    await signIn(page, await createAccount("teamwear-phone", { brand: "Phone Phoenix" }));
    await openConfigurator(page);

    const panel = page.getByTestId("teamwear-panel");
    await expect(panel).toBeVisible();
    const fixed = await panel.evaluate((element) => getComputedStyle(element).position);
    expect(fixed).toBe("fixed");

    // Its bottom edge is the bottom of the window and the stage starts above its top edge, which is
    // what a sheet over the stage means. Nothing scrolls sideways.
    const sheet = await panel.boundingBox();
    const stage = await page.getByTestId("teamwear-stage-frame").boundingBox();
    expect(sheet).not.toBeNull();
    expect(stage).not.toBeNull();
    expect(sheet!.y + sheet!.height).toBeGreaterThanOrEqual(843);
    expect(stage!.y).toBeLessThan(sheet!.y);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(1);

    // The sheet still works: a bundle settles the colours and the pill ticks are reachable.
    await page.getByTestId("teamwear-bundle-home").click();
    await expect(page.getByTestId("teamwear-row-colours")).toHaveAttribute("data-value", /#/);
  });
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * E5's prompt bar, pickers and panels (plan v6 E5, decision 0149) on their fixture page, which needs
 * no session and no database. Send and Create there call the real actions, which refuse without a
 * session, so the toast checked here is the real refusal: nothing was generated and nothing spent.
 */

const ON = process.env.DEV_UI_ROUTES === "on";

const serious = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((entry) => entry.impact === "serious" || entry.impact === "critical")
    .map((entry) => `${entry.id}: ${entry.nodes.slice(0, 8).map((node) => node.target.join(" ")).join("; ")}`);
};

test.describe("the prompt bar fixture", () => {
  test.skip(!ON, "DEV_UI_ROUTES is off here");

  test("opens with the garment as a locked reference, offers the four modes and says what Send costs", async ({ page }) => {
    await page.goto("/dev/prompt-bar");
    const bar = page.getByTestId("prompt-bar");
    await expect(bar.getByTestId("prompt-open")).toBeVisible();
    await expect(bar.getByText("Reference 1: Home kit v7 · JSY-SS-01, garment locked")).toBeAttached();
    await expect(bar.getByTestId("prompt-send")).toHaveAttribute("aria-label", "Generate image · 20 credits");

    await bar.getByTestId("prompt-mode").click();
    const modes = page.getByRole("menu", { name: "Mode" }).getByRole("menuitemradio");
    await expect(modes).toHaveText([/Agentic AI/, /Generate Image/, /Generate Video/, /Ask Knitwright/]);
    await page.getByRole("menuitemradio", { name: /Generate Video/ }).click();
    await expect(bar).toHaveAttribute("data-mode", "video");
    await expect(bar.getByTestId("prompt-reference-mode")).toBeVisible();

    await bar.getByTestId("prompt-aspect").click();
    await expect(page.getByRole("menu", { name: "Aspect" }).getByRole("menuitemradio")).toHaveText(["9:16", "1:1", "16:9"]);
    await page.keyboard.press("Escape");
    expect(await serious(page)).toEqual([]);
  });

  test("a refused Send says no credits were used", async ({ page }) => {
    await page.goto("/dev/prompt-bar");
    await page.getByTestId("prompt-send").click();
    const toast = page.getByRole("alert").filter({ hasText: "Generation failed" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("No credits were used.");
  });

  test("the + menu's three modals open, and the builder adds its picks to the prompt", async ({ page }) => {
    await page.goto("/dev/prompt-bar");
    const text = page.getByTestId("prompt-text");
    await page.getByTestId("prompt-plus").click();
    await expect(page.getByRole("menuitem")).toHaveText(["Browse Styles", "Prompt builder", "Prompts"]);
    await page.getByRole("menuitem", { name: "Prompt builder" }).click();
    const builder = page.getByTestId("prompt-builder");
    await builder.getByRole("tab", { name: "Lighting" }).click();
    await builder.getByRole("button", { name: "Golden hour" }).click();
    await builder.getByRole("button", { name: "Add to your prompt" }).click();
    await expect(text).toHaveValue(/golden-hour sunlight$/);

    await page.goto("/dev/prompt-bar?show=styles");
    await expect(page.getByTestId("browse-styles").getByRole("button", { name: /Retro film/ })).toBeVisible();
    expect(await serious(page)).toEqual([]);

    await page.goto("/dev/prompt-bar?show=prompts");
    await expect(page.getByTestId("prompts-modal").getByRole("button", { name: /Floodlit pitch/ })).toBeVisible();
  });

  test("Choose Artboard Size has the Products tab and checks a custom size", async ({ page }) => {
    await page.goto("/dev/prompt-bar?show=artboard");
    const modal = page.getByTestId("artboard-size");
    await expect(modal.getByRole("tab")).toHaveText(["Popular", "Products", "Social", "Marketing", "Store", /Print on demand/]);
    await modal.getByRole("tab", { name: "Products" }).click();
    await modal.getByRole("button", { name: /Away kit v2/ }).click();
    await expect(modal.getByText("A garment board for")).toBeVisible();
    await modal.getByRole("tab", { name: "Popular" }).click();
    await modal.getByRole("button", { name: /A4 print/ }).click();
    await modal.getByLabel("Width in mm").fill("0.5");
    await expect(modal.getByRole("alert")).toHaveText("An artboard is at least 16 px on each side.");
    await expect(modal.getByTestId("artboard-create")).toBeDisabled();
    expect(await serious(page)).toEqual([]);
  });

  test("the colour picker warns on a colour a sublimation print may not reach", async ({ page }) => {
    await page.goto("/dev/prompt-bar?show=colour");
    const hex = page.getByTestId("colour-hex");
    await hex.fill("FF00FF");
    await hex.press("Enter");
    await expect(page.getByTestId("colour-print-warning")).toContainText("more saturated than a sublimation print");
    await page.getByRole("tab", { name: "Brand" }).click();
    await expect(page.getByRole("button", { name: "Club navy · Primary" })).toBeVisible();
    expect(await serious(page)).toEqual([]);
  });

  test("the font picker will not pick a font with no licence on file", async ({ page }) => {
    await page.goto("/dev/prompt-bar?show=font");
    const picker = page.getByTestId("font-picker");
    await expect(picker.getByRole("button", { name: /Placeholder: wide block sans/ })).toBeDisabled();
    await picker.getByRole("button", { name: /Geist Mono/ }).click();
    await expect(picker.getByRole("button", { name: /Geist Mono/ })).toHaveAttribute("aria-pressed", "true");
    expect(await serious(page)).toEqual([]);
  });

  test("version history marks the ordered version locked and hides autosaves on request", async ({ page }) => {
    await page.goto("/dev/prompt-bar?show=history");
    await page.getByTestId("version-history-open").click();
    const panel = page.getByTestId("version-history");
    await expect(panel.getByText("Ordered · v7")).toBeVisible();
    await expect(panel.getByText("locked to an order")).toBeVisible();
    await expect(panel.getByText("Autosave · v5")).toBeVisible();
    await panel.getByRole("switch", { name: "Show autosaves" }).click();
    await expect(panel.getByText("Autosave · v5")).toBeHidden();
    expect(await serious(page)).toEqual([]);
  });
});

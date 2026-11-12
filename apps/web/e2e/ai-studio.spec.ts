import { expect, type Page } from "@playwright/test";
import { accessible } from "./chrome";
import { createAccount, signIn, test } from "./support";

/**
 * AI Studio (plan v6 P3, decision 0141): the workflows hub, a workflow page per launch workflow, the
 * Creative Agent over Ask and the design chat, and the two generator tabs.
 *
 * Each test signs a new account in, so no run finds another's rows (Lesson 11). Nothing here calls a
 * paid provider: the paid workflows are off in CI and must say so, with no output.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  const email = await createAccount(label);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/studio$/);
};

const newDesign = async (page: Page, name: string): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
};

test.describe("AI Studio", () => {
  test("opens on the workflows hub, whose tabs and search narrow the rows", async ({ page }) => {
    await signedIn(page, "ai-hub");
    await page.goto("/ai-studio");
    await expect(page.getByRole("heading", { name: "What do you want to create today?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start a workflow" })).toBeVisible();
    await expect(page.getByTestId("ai-studio-workflow-card").filter({ hasText: "Crest to kit" }).first()).toBeVisible();

    await page.getByRole("tab", { name: "Ads" }).click();
    await expect(page.getByTestId("ai-studio-workflow-card")).toHaveText(["Kit launch ad", "Team store promo"]);

    await page.getByRole("tab", { name: "Discover" }).click();
    await page.getByLabel("Search workflows").fill("zzzz");
    await expect(page.getByText("No workflow matches")).toBeVisible();
    await page.getByRole("button", { name: "Clear the search" }).click();

    await page.getByRole("button", { name: "Browse styles" }).click();
    await expect(page.getByRole("dialog", { name: "Browse styles" })).toBeVisible();
    await page.getByRole("dialog").getByRole("link", { name: "Retro film" }).click();
    await expect(page).toHaveURL(/\/ai-studio\/image\?style=retro-film/);
    await accessible(page);
  });

  test("moves crest to kit and the benchmarks into workflow pages, and the old addresses still answer", async ({ page }) => {
    await signedIn(page, "ai-moves");
    await page.goto("/crest-to-kit");
    await expect(page).toHaveURL(/\/ai-studio\/workflow\/crest-to-kit$/);
    await expect(page.getByTestId("crest-to-kit")).toBeVisible();
    await page.goto("/studio/benchmarks");
    await expect(page).toHaveURL(/\/ai-studio\/workflow\/benchmark-products$/);
    await expect(page.getByRole("heading", { level: 1, name: "Benchmark products" })).toBeVisible();
  });

  test("a paid workflow says it is not available yet and offers no Generate", async ({ page }) => {
    await signedIn(page, "ai-gated");
    for (const id of ["on-model-try-on", "flat-lay-studio", "try-on-video", "remove-background"]) {
      await page.goto(`/ai-studio/workflow/${id}`);
      await expect(page.getByText("Not available yet.", { exact: false })).toBeVisible();
      await expect(page.getByRole("button", { name: /Generate/ })).toHaveAttribute("aria-disabled", "true");
    }
  });

  test("a canvas workflow keeps Generate disabled until the form is valid, then opens a launch canvas", async ({ page }) => {
    await signedIn(page, "ai-canvas");
    await newDesign(page, "Matchday shirt");
    await page.goto("/ai-studio/workflow/matchday-graphic");
    const generate = page.getByRole("button", { name: /Generate/ });
    await expect(generate).toHaveAttribute("aria-disabled", "true");
    await page.getByLabel("1. Choose a product").selectOption({ label: "Matchday shirt · Crew neck tee" });
    await page.getByLabel("2. Opponent").fill("Northfield Town");
    await page.getByLabel("3. Where and when").fill("Home, Sat 15:00");
    await expect(generate).not.toHaveAttribute("aria-disabled", "true");
    await accessible(page);
    await generate.click();
    await expect(page).toHaveURL(/\/launch\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  });

  test("Retro kit remix makes validated variants of a design and saves the one picked", async ({ page }) => {
    await signedIn(page, "ai-remix");
    await newDesign(page, "Remix shirt");
    await page.goto("/ai-studio/workflow/retro-kit-remix");
    await page.getByLabel("1. Pick a product").selectOption({ label: "Remix shirt · Crew neck tee" });
    await page.getByRole("group", { name: "Era" }).getByRole("button", { name: "80s" }).click();
    await page.getByRole("button", { name: /Generate 4/ }).click();
    const variants = page.getByTestId("ai-studio-variants");
    await expect(variants.getByRole("listitem")).toHaveCount(4, { timeout: 30_000 });
    await variants.getByRole("button", { name: "Use this design" }).first().click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  });

  test("the Creative Agent answers a question from the rulebook and starts a design from a request", async ({ page }) => {
    await signedIn(page, "ai-agent");
    await page.goto("/ai-studio/agent");
    await expect(page.getByRole("heading", { level: 1, name: "Creative Agent" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "Quick-start a project" })).toBeVisible();
    await accessible(page);

    const path = page.getByRole("combobox").filter({ hasText: "Choose one" });
    if (await path.isVisible()) await path.selectOption({ label: "Team kit" });
    await page.getByLabel("Ask Creative Agent").fill("Home kit for a navy and gold cricket club");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}\/guide\?step=start&from=text/, { timeout: 30_000 });
  });

  test("the Image and Video generators show the locked garment step and their credits", async ({ page }) => {
    await signedIn(page, "ai-generators");
    await page.goto("/ai-studio/image");
    await expect(page.getByRole("heading", { level: 1, name: "Image generator" })).toBeVisible();
    await expect(page.getByText("1. Reference (garment locked)")).toBeVisible();
    await page.goto("/ai-studio/video");
    await expect(page.getByRole("heading", { level: 1, name: "Video generator" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Generate · \d+ credits$/ })).toBeVisible();
  });
});

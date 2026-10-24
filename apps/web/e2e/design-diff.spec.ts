import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, standInForBotCheck, test } from "./support";

/** Plan v4 W2-B: chat edits as design diffs. The model is the stand-in (AI_PROVIDER_STUB=on); no live model is called. */

const startDesign = async (page: Page): Promise<void> => {
  await signIn(page, await createAccount("design-diff"));
  await expect(page).toHaveURL(/\/studio$/);
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill("Diff shirt");
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
};

const preview = async (page: Page, words: string) => {
  const panel = page.getByTestId("diff-panel");
  await panel.getByLabel("Say what to change, then check it before it is made").fill(words);
  await panel.getByRole("button", { name: "Preview change" }).click();
  return panel;
};

test.describe("chat edits as design diffs", () => {
  test.beforeEach(async ({ context }) => {
    await standInForBotCheck(context);
  });

  test("confirming a previewed change makes the next version", async ({ page }) => {
    await startDesign(page);
    await expect(page.getByTestId("version")).toHaveText("Version 1");
    const panel = await preview(page, "slim fit");
    const card = panel.getByTestId("diff-card");
    await expect(card).toBeVisible();
    await expect(card.getByText("Before")).toBeVisible();
    await expect(card.getByText("After")).toBeVisible();
    // Nothing is saved until Confirm.
    await expect(page.getByTestId("version")).toHaveText("Version 1");

    await card.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByTestId("version")).toHaveText("Version 2");
    await expect(card).toBeHidden();
  });

  test("discarding leaves the design at the same version", async ({ page }) => {
    await startDesign(page);
    const panel = await preview(page, "slim fit");
    await panel.getByRole("button", { name: "Discard" }).click();
    await expect(panel.getByTestId("diff-card")).toBeHidden();
    await page.reload();
    await expect(page.getByTestId("version")).toHaveText("Version 1");
  });

  test("an unsupported request is refused in words and changes nothing", async ({ page }) => {
    await startDesign(page);
    const panel = await preview(page, "put a dragon on the back");
    await expect(panel.getByText("That is not a change the assistant can make here yet.")).toBeVisible();
    await expect(page.getByTestId("version")).toHaveText("Version 1");
  });
});

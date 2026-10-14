import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * The studio home: a new brand sees how a design gets made; a brand with designs sees what is
 * waiting on it, made only from what is stored, and each design's step and last change.
 */

const startDesign = async (page: Page, name: string): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

test.describe("the studio home", () => {
  test("a new brand sees the four steps and where its first design will go", async ({ page }) => {
    await signIn(page, await createAccount("home-empty", { brand: "Fresh Rovers" }));
    await expect(page).toHaveURL(/\/studio$/);

    const steps = page.getByRole("region", { name: "How a design gets made" });
    await expect(steps.getByRole("listitem")).toHaveText([/^1Design/, /^2Factory file/, /^3Committee/, /^4Quote/]);
    await expect(page.getByRole("heading", { name: "Start your first design" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Needs you" })).toHaveCount(0);
  });

  test("lists what needs the member, and moves a design on once it is shared", async ({ page }) => {
    await signIn(page, await createAccount("home-needs", { brand: "Harbour Hockey" }));
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Home kit 2027");

    await page.goto("/studio");
    const needs = page.getByRole("region", { name: "Needs you" });
    const finish = needs.getByRole("link", { name: /^Home kit 2027: \d+ things? to confirm for the factory Finish$/ });
    await expect(finish).toHaveAttribute("href", /\/studio\/[0-9a-f-]{36}\/tech-pack$/);
    const card = page.getByRole("list", { name: /^Designs of / }).getByTestId("design-card");
    await expect(card).toContainText("Step 1 of 4: Design");
    await expect(card).toContainText(/Just now|minutes? ago/);
    await expect(card.locator("img")).toHaveAttribute("src", /^data:image\/svg\+xml;/);

    await card.click();
    const panel = page.getByRole("region", { name: "Share with your committee" });
    await panel.getByRole("button", { name: "Make a share link" }).click();
    await expect(panel.getByTestId("share-link")).toHaveCount(1);

    await page.goto("/studio");
    await expect(needs.getByRole("link", { name: "Home kit 2027: committee vote open, no votes yet See votes" })).toBeVisible();
    await expect(page.getByTestId("design-card")).toContainText("Step 3 of 4: Committee");
  });
});

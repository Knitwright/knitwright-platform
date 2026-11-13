import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { accessible } from "./chrome";
import { createAccount, signIn, test } from "./support";

/**
 * TAKING A STYLE OUT OF A PLAN, AND DELETING A PLAN (decision 0124).
 *
 * `removeStyleAction` and `removeCollectionAction` were both finished -- the ability check, the
 * database function, the revalidate -- and neither had a button anywhere, so a founder could plan a
 * range, add a style by mistake, and never get rid of either.
 *
 * The two are not asked for in the same way, and that is the point of the test: a style card is one
 * row of a plan and is removed after a question that **names it**; a whole plan takes the typed
 * word, exactly as deleting a design does.
 *
 * Each test makes its own account and its own plan name: the whole suite shares one database (plan
 * v5, lesson 11).
 */

const signedIn = async (page: Page, label: string): Promise<string> => {
  const email = await createAccount(label);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/projects\/recent$/);
  return email;
};

const startPlan = async (page: Page, label: string): Promise<string> => {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/orders/plans");
  await expect(page.getByRole("heading", { level: 2, name: "Collection plans" })).toBeVisible();
  await page.getByLabel("Name this plan").fill(name);
  await page.getByLabel("Landed in").selectOption({ label: "United Kingdom (GBP)" });
  await page.getByRole("button", { name: "Start the plan" }).click();
  await expect(page.getByText(new RegExp(`${name} is ready`))).toBeVisible();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return name;
};

const addStyle = async (page: Page, name: string): Promise<void> => {
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Colourway", { exact: true }).fill("Navy and gold");
  await page.getByLabel("Group", { exact: true }).selectOption({ label: "Core" });
  await page.getByLabel("Article code", { exact: true }).fill("JSY-SS-01");
  await page.getByLabel("Fabric code", { exact: true }).fill("F-POLY-INT");
  await page.getByLabel("Production class", { exact: true }).selectOption({ label: "Class A" });
  await page.getByLabel(/^Wholesale price/).fill("42.00");
  await page.getByLabel(/^RRP/).fill("80.00");
  await page.getByLabel("Wholesale share (%)", { exact: true }).fill("60");
  // The form reads sizes as "S:10, M:20" (`lib/collections/entry.ts`); "S 10" is unreadable and the
  // style is never added, which is how this helper failed before.
  await page.getByLabel("Sizes and pieces", { exact: true }).fill("S:10, M:20, L:10");
  await page.getByRole("button", { name: "Add this style" }).click();
  await expect(page.getByText(`${name} is on the board`)).toBeVisible();
};

test.describe("taking a style out of a plan", () => {
  test("asks a question that names the style, and keeps it when the answer is no", async ({ page }) => {
    await signedIn(page, "style-remove");
    await startPlan(page, "Remove plan");
    const style = `Away jersey ${randomUUID().slice(0, 6)}`;
    await addStyle(page, style);

    const card = page.getByRole("article").filter({ hasText: style });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: `Remove ${style} from this plan` }).click();
    await expect(card).toContainText(`Remove ${style} from this plan?`);
    await expect(card).toContainText("The design itself is not deleted.");

    // Kept: the question goes away and the card stays.
    await card.getByRole("button", { name: "Keep it" }).click();
    await expect(card).not.toContainText("The design itself is not deleted.");
    await expect(card).toBeVisible();

    // Over the style cards rather than the whole plan page, which no spec scans whole.
    await accessible(page, "article");

    // Removed: the card goes, and it is still gone when the plan is read again.
    await card.getByRole("button", { name: `Remove ${style} from this plan` }).click();
    await card.getByRole("button", { name: "Remove it" }).click();
    await expect(page.getByRole("article").filter({ hasText: style })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("article").filter({ hasText: style })).toHaveCount(0);
  });
});

test.describe("deleting a collection plan", () => {
  test("is reached from the plan's own actions, names what goes, and asks for the word", async ({ page }) => {
    await signedIn(page, "plan-delete");
    const name = await startPlan(page, "Doomed plan");
    await addStyle(page, "Home jersey");

    await page.getByRole("link", { name: "Delete this plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText(/This deletes the plan, its groups and its 1 style/)).toBeVisible();
    await expect(page.getByText(/The designs behind the style cards are not touched/)).toBeVisible();
    await accessible(page);

    // The word is what lets it run.
    await page.getByRole("button", { name: "Delete this plan" }).click();
    await expect(page.getByText('Type "delete" to confirm.')).toBeVisible();

    await page.getByLabel('Type "delete" to confirm').fill("delete");
    await page.getByRole("button", { name: "Delete this plan" }).click();

    await expect(page).toHaveURL(/\/orders\/plans$/);
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  });

  test("keeps the plan when the way back is taken", async ({ page }) => {
    await signedIn(page, "plan-keep");
    const name = await startPlan(page, "Kept plan");

    await page.getByRole("link", { name: "Delete this plan" }).click();
    await page.getByRole("link", { name: "Keep it and go back" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await page.goto("/orders/plans");
    await expect(page.getByRole("link", { name })).toBeVisible();
  });
});

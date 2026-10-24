import { expect } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * The credits page and the balance chip. Nothing is gated yet, so a new brand has its monthly free
 * credits (a placeholder number, said so on the page) and a history of one line.
 */

test.describe("credits", () => {
  test("a new brand sees its free credits, the placeholder notice and one line of history", async ({ page }) => {
    await signIn(page, await createAccount("credits-new", { brand: "Credit Rovers" }));
    await expect(page).toHaveURL(/\/studio$/);

    const chip = page.getByTestId("credit-balance");
    await expect(chip).toContainText(/\d+/);
    await chip.click();

    await expect(page).toHaveURL(/\/credits$/);
    await expect(page.getByRole("heading", { level: 1, name: "Credits" })).toBeVisible();
    await expect(page.getByTestId("credit-balance-figure")).toContainText(/^\d+ credits$/);
    await expect(page.getByText(/placeholder numbers, not a price/i)).toBeVisible();
    await expect(page.getByText("Nothing uses credits yet.")).toBeVisible();

    const history = page.getByRole("table", { name: /Credit history of Credit Rovers/ });
    await expect(history.getByRole("row")).toHaveCount(2);
    await expect(history).toContainText("Credits added: Monthly free credits");
  });

  test("opening the page twice gives the month's credits once", async ({ page }) => {
    await signIn(page, await createAccount("credits-twice", { brand: "Credit Twice FC" }));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/credits");
    const first = await page.getByTestId("credit-balance-figure").innerText();
    await page.reload();
    await expect(page.getByTestId("credit-balance-figure")).toHaveText(first);
  });

  test("a visitor is sent to sign in", async ({ page }) => {
    await page.goto("/credits");
    await expect(page).toHaveURL(/sign-in/);
  });
});

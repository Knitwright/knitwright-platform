import { expect, test } from "@playwright/test";

test("home page shows the product name and a main heading", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Knitwright/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
});

test("skip link is the first thing keyboard focus reaches", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

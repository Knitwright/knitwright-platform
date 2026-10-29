import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test } from "./support";

/**
 * Decision 0071, the factory model as data: a page that does not exist for everyone but a platform admin, and
 * for an admin the seeded placeholder factory, its price ladder and a change that takes effect.
 */

test.describe("the factories page", () => {
  test("does not exist for a visitor or a member", async ({ page }) => {
    expect((await page.goto("/ops/factories"))?.status()).toBe(404);
    const email = await createAccount("factories-member");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    expect((await page.goto("/ops/factories"))?.status()).toBe(404);
  });

  test("shows an admin the seeded factory and its ladder, and saves a change", async ({ page }) => {
    const email = await createAccount("factories-admin");
    await makePlatformAdmin(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto("/ops/factories");
    await expect(page.getByRole("heading", { name: "Factories", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sialkot partner (placeholder)" })).toBeVisible();
    await expect(page.getByTestId("cutoff-summary")).toContainText("Monday 12:00");
    await expect(page.getByTestId("cutoff-summary")).toContainText("Asia/Karachi");
    // Every price is a placeholder from the build pack and the page says so.
    await expect(page.getByTestId("tier").first()).toContainText("£29.00");
    await expect(page.getByTestId("tier").first()).toContainText("not a factory quote");
    // No delivery date is promised while the QC days and the freight days are not agreed.
    await expect(page.getByTestId("capability").first()).toContainText("no delivery date yet");

    // A quantity change that would break the ladder is refused in words.
    const qtyMax = page.getByTestId("field-price_tiers-qty_max").first();
    await qtyMax.getByLabel("To (pieces, blank for no limit)").fill("25");
    await qtyMax.getByRole("button", { name: "Save", exact: true }).click();
    await expect(qtyMax.getByRole("alert")).toContainText("overlap");

    // A colour tolerance a factory has confirmed is saved.
    const delta = page.getByTestId("field-factory_capabilities-colour_delta_max").first();
    await delta.getByLabel("Largest colour difference (delta E)").fill("1.2");
    await delta.getByRole("button", { name: "Save", exact: true }).click();
    await expect(delta.getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("field-factory_capabilities-colour_delta_max").first().getByLabel("Largest colour difference (delta E)")).toHaveValue("1.20");
  });
});

import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test } from "./support";

/**
 * Decision 0056, the platform settings console: a page that does not exist for everyone but a platform admin, and
 * for an admin a change that the ops page shows, with who made it, and that can be put back to the default.
 */

test.describe("the settings console", () => {
  test("does not exist for a visitor or a member", async ({ page }) => {
    expect((await page.goto("/admin/settings"))?.status()).toBe(404);
    const email = await createAccount("settings-member");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    expect((await page.goto("/admin/settings"))?.status()).toBe(404);
  });

  test("lets an admin change the cut-off, shows it on the ops page, then puts it back", async ({ page }) => {
    const email = await createAccount("settings-admin");
    await makePlatformAdmin(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    const time = page.getByTestId("setting-ops.cutoff_minutes");
    await expect(page.getByTestId("source-ops.cutoff_minutes")).toContainText("Knitwright default, not agreed with a factory");

    // A value that is not allowed comes back in words and changes nothing.
    await page.getByTestId("setting-guardrails.bleed_mm").getByLabel("Bleed (mm)").fill("500");
    await page.getByTestId("setting-guardrails.bleed_mm").getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Use 50 or less.")).toBeVisible();

    await time.getByLabel("Weekly batch cut-off: time (UTC)").fill("07:00");
    await time.getByRole("button", { name: "Save", exact: true }).click();
    await expect(time.getByText("Saved.")).toBeVisible();
    await expect(page.getByTestId("source-ops.cutoff_minutes")).toContainText(`Set by ${email}`);

    await page.goto("/ops/settings");
    await expect(page.getByLabel("Cut-off time (UTC)")).toHaveValue("07:00");
    await expect(page.getByText(`Set by ${email}`)).toBeVisible();

    await page.goto("/admin/settings");
    await page.getByTestId("setting-ops.cutoff_minutes").getByRole("button", { name: "Use the Knitwright default" }).click();
    await expect(page.getByTestId("source-ops.cutoff_minutes")).toContainText("Knitwright default, not agreed with a factory");
    await page.goto("/ops/settings");
    await expect(page.getByLabel("Cut-off time (UTC)")).toHaveValue("17:00");
  });
});

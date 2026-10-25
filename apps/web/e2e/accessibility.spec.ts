import { expect } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/** Decision 0064: the design assistant, a dialog on a phone, holds focus while it is open and gives it back. */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.describe("keyboard", () => {
  test("the assistant sheet traps Tab, closes on Escape and returns focus to its button", async ({ page }) => {
    await signIn(page, await createAccount("a11y-sheet"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/studio/new");
    await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
    await page.getByLabel("Made for").selectOption({ label: "Women" });
    await page.getByLabel("Design name").fill("Focus tee");
    await page.getByRole("button", { name: "Create design" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Focus tee" })).toBeVisible();

    const opener = page.getByRole("button", { name: "Assistant", exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Design assistant" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    for (let press = 0; press < 25; press += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement)), `Tab ${press + 1} left the sheet`).toBe(true);
    }
    for (let press = 0; press < 25; press += 1) {
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement)), `Shift+Tab ${press + 1} left the sheet`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

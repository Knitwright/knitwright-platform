import { expect } from "@playwright/test";
import { signUnsubscribe, unsubscribeKey } from "../lib/consent/unsubscribe-token";
import { consentRecords, createAccount, invite, passBotCheck, signIn, signUpLinkForm, test, uniqueEmail, userIdOf } from "./support";

/**
 * Consent to marketing email (decision 0025; the Platform and Store Guide, page 10): an
 * unticked box at sign-up, a choice in Settings, and an unsubscribe link that works without
 * signing in. Each choice is a record that is only ever added to.
 */

const BOX = "Email me about new templates, season deadlines and offers. You can stop at any time.";

const tokenFor = (userId: string): string => {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return signUnsubscribe(userId, unsubscribeKey(secret));
};

test.describe("marketing email consent", () => {
  test("the box at sign-up starts unticked, and a ticked box is recorded with the words shown", async ({ page }) => {
    const email = uniqueEmail("consent-signup");
    await invite(email);

    await page.goto("/sign-up");
    const box = page.getByLabel(BOX);
    await expect(box).not.toBeChecked();
    await box.check();
    await page.getByLabel("Work email").fill(email);
    await passBotCheck(signUpLinkForm(page));
    await page.getByRole("button", { name: "Send me a link" }).click();
    await expect(page.getByText("Check your email.")).toBeVisible();

    await expect
      .poll(async () => consentRecords(await userIdOf(email)))
      .toEqual([{ granted: true, source: "sign-up", wording_version: "marketing-email-v1" }]);
  });

  test("a sign-up with the box left alone is recorded as a no", async ({ page }) => {
    const email = uniqueEmail("consent-no");
    await invite(email);

    await page.goto("/sign-up");
    await page.getByLabel("Work email").fill(email);
    await passBotCheck(signUpLinkForm(page));
    await page.getByRole("button", { name: "Send me a link" }).click();
    await expect(page.getByText("Check your email.")).toBeVisible();

    await expect
      .poll(async () => consentRecords(await userIdOf(email)))
      .toEqual([{ granted: false, source: "sign-up", wording_version: "marketing-email-v1" }]);
  });

  test("the choice can be changed in Settings, and each change is a new record", async ({ page }) => {
    const email = await createAccount("consent-settings");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto("/settings");
    const box = page.getByLabel(BOX);
    await expect(box).not.toBeChecked();
    await box.check();
    await page.getByRole("button", { name: "Save email choice" }).click();
    await expect(page.getByText("Saved. We may email you about these.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel(BOX)).toBeChecked();
    await page.getByLabel(BOX).uncheck();
    await page.getByRole("button", { name: "Save email choice" }).click();
    await expect(page.getByText("Saved. We will not email you about these.")).toBeVisible();

    expect(await consentRecords(await userIdOf(email))).toEqual([
      { granted: true, source: "settings", wording_version: "marketing-email-v1" },
      { granted: false, source: "settings", wording_version: "marketing-email-v1" },
    ]);
  });

  test("an unsubscribe link works without signing in, and opening it changes nothing", async ({ page }) => {
    const email = await createAccount("consent-unsubscribe");
    const userId = await userIdOf(email);

    await page.goto(`/unsubscribe?token=${encodeURIComponent(tokenFor(userId))}`);
    await expect(page.getByRole("heading", { name: "Unsubscribe" })).toBeVisible();
    expect(await consentRecords(userId)).toEqual([]);

    await page.getByRole("button", { name: "Stop these emails" }).click();
    await expect(page.getByText("You will get no more emails from us")).toBeVisible();
    expect(await consentRecords(userId)).toEqual([
      { granted: false, source: "unsubscribe", wording_version: "marketing-email-unsubscribe-v1" },
    ]);
  });

  test("an unsubscribe link that was tampered with is refused in plain words", async ({ page }) => {
    await page.goto("/unsubscribe?token=forged.token");
    await expect(page.getByText("This link could not be checked.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop these emails" })).toHaveCount(0);
  });
});

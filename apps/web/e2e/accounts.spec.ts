import { expect } from "@playwright/test";
import {
  createAccount,
  invite,
  linkFromMail,
  passBotCheck,
  PASSWORD,
  signIn,
  test,
  uniqueEmail,
} from "./support";

test.describe("accounts", () => {
  test("an invited person signs up, confirms by email, signs out and signs in again", async ({
    page,
  }) => {
    const email = uniqueEmail("signup");
    await invite(email);

    await page.goto("/sign-up");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await passBotCheck(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your email.")).toBeVisible();

    await page.goto(await linkFromMail(email, /confirm/i));
    await page.getByRole("button", { name: "Confirm email" }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByTestId("account-email")).toHaveText(email);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
  });

  test("a new address cannot register while sign-up is closed", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByText(/not open to new accounts yet/)).toBeVisible();

    await page.getByLabel("Work email").fill(uniqueEmail("stranger"));
    await page.getByLabel("Password").fill(PASSWORD);
    await passBotCheck(page);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toContainText("Sign-up is closed");
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("a wrong password is refused and the address stays in the form", async ({ page }) => {
    const email = await createAccount("wrong-password");

    await signIn(page, email, "not-the-password");

    await expect(page.getByRole("main").getByRole("alert")).toContainText("do not match");
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a short password is refused with a message beside the field", async ({ page }) => {
    const email = uniqueEmail("short");
    await invite(email);

    await page.goto("/sign-up");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill("short");
    await passBotCheck(page);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  });

  test("a forgotten password is reset by email", async ({ page }) => {
    const email = await createAccount("reset");
    const newPassword = "a-brand-new-password";

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await passBotCheck(page);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Check your email.")).toBeVisible();

    await page.goto(await linkFromMail(email, /reset/i));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL(/\/studio$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/studio$/);
  });

  test("a link with no token leads back to sign-in with an explanation", async ({ page }) => {
    await page.goto("/auth/confirm");

    await expect(page).toHaveURL(/\/sign-in\?notice=link-missing$/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("incomplete");
  });

  test("a notice the app does not know is not shown", async ({ page }) => {
    await page.goto("/sign-in?notice=%3Cb%3Ehello%3C%2Fb%3E");

    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("hello")).toHaveCount(0);
  });
});

test("repeated attempts from one address are slowed down", async ({ page }) => {
  // The sign-up limit is 5 an hour for one address. The sixth attempt is refused
  // before it reaches the sign-in service.
  test.slow();
  await page.goto("/sign-up");

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await page.getByLabel("Work email").fill(uniqueEmail(`flood-${attempt}`));
    await page.getByLabel("Password").fill(PASSWORD);
    await passBotCheck(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      attempt <= 5 ? "Sign-up is closed" : "Too many requests",
    );
  }
});

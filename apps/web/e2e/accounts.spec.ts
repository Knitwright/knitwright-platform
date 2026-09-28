import { expect } from "@playwright/test";
import {
  accountExists,
  createAccount,
  invite,
  linkFromMail,
  mailCount,
  passBotCheck,
  PASSWORD,
  signIn,
  summary,
  test,
  uniqueEmail,
} from "./support";

const askForLink = async (page: import("@playwright/test").Page, email: string) => {
  await page.goto("/sign-up");
  await page.getByLabel("Work email").fill(email);
  await passBotCheck(page);
  await page.getByRole("button", { name: "Send me a link" }).click();
};

test.describe("accounts", () => {
  test("an invited person confirms by email, chooses a password, signs out and signs in", async ({
    page,
  }) => {
    const email = uniqueEmail("signup");
    await invite(email);

    await askForLink(page, email);
    await expect(page.getByText("Check your email.")).toBeVisible();

    await page.goto(await linkFromMail(email, /confirm/i));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByRole("heading", { name: "Choose a password" })).toBeVisible();

    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByTestId("account-email")).toHaveText(email);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
  });

  test("a new address gets no account while sign-up is closed, and is told the same as anyone", async ({
    page,
  }) => {
    const stranger = uniqueEmail("stranger");

    await page.goto("/sign-up");
    await expect(page.getByText(/not open to new accounts yet/)).toBeVisible();
    await askForLink(page, stranger);

    await expect(page.getByText("Check your email.")).toBeVisible();
    expect(await accountExists(stranger)).toBe(false);
    expect(await mailCount(stranger)).toBe(0);
  });

  test("an address that already has an account is sent a link that signs it in", async ({
    page,
  }) => {
    const email = await createAccount("returning");

    await askForLink(page, email);
    await expect(page.getByText("Check your email.")).toBeVisible();

    await page.goto(await linkFromMail(email, /sign in/i));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/studio$/);
  });

  test("a wrong password is refused and the address stays in the form", async ({ page }) => {
    const email = await createAccount("wrong-password");

    await signIn(page, email, "not-the-password");

    await expect(summary(page)).toContainText("do not match");
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a short password is refused, and focus moves to the field", async ({ page }) => {
    const email = uniqueEmail("short");
    await invite(email);
    await askForLink(page, email);
    await page.goto(await linkFromMail(email, /confirm/i));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/reset-password$/);

    await page.getByLabel("New password").fill("short");
    await page.getByRole("button", { name: "Save password" }).click();

    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await expect(summary(page)).toContainText("Some fields need another look.");
    await expect(page.getByLabel("New password")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("New password")).toBeFocused();
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
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page).toHaveURL(/\/studio$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/studio$/);
  });

  test("a link that was already used is refused with an explanation", async ({ page }) => {
    const email = uniqueEmail("used");
    await invite(email);
    await askForLink(page, email);
    const link = await linkFromMail(email, /confirm/i);
    await page.goto(link);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/reset-password$/);

    await page.context().clearCookies();
    await page.goto(link);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(summary(page)).toContainText("expired or was already used");
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

test.describe("the bot check", () => {
  test("holds the form back, and says why, when the button is pressed too early", async ({
    page,
  }) => {
    // The check never finishes, because its script is kept from loading.
    await page.route("**/challenges.cloudflare.com/**", (route) => new Promise(() => route));
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("maker@example.com");
    await page.getByLabel("Password").fill(PASSWORD);

    await expect(page.getByText("Checking that you are a person.")).toBeVisible();
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("The check has not finished yet.")).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveValue(PASSWORD);
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("says what to do when it cannot load", async ({ page }) => {
    await page.route("**/challenges.cloudflare.com/**", (route) => route.abort());
    await page.goto("/sign-in");

    await expect(page.getByText("The check could not load.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});

test("repeated attempts from one address are slowed down", async ({ page }) => {
  // The sign-up limit is 5 an hour for one address. The sixth attempt is refused
  // before it reaches the sign-in service.
  test.slow();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await askForLink(page, uniqueEmail(`flood-${attempt}`));
    await expect(page.getByText("Check your email.")).toBeVisible();
  }

  await askForLink(page, uniqueEmail("flood-6"));
  await expect(summary(page)).toContainText("Too many requests");
});

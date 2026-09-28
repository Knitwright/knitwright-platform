import { expect } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

test.describe("every page", () => {
  for (const path of ["/", "/sign-in", "/auth/confirm?token_hash=x&type=email"]) {
    test(`${path} cannot be shown inside another site's frame`, async ({ request }) => {
      const headers = (await request.get(path)).headers();

      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    });
  }

  test("tells the browser not to guess file types or leak addresses", async ({ request }) => {
    const headers = (await request.get("/")).headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["content-security-policy"]).toContain("base-uri 'self'");
    expect(headers["strict-transport-security"]).toMatch(/max-age=\d{8}/);
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("switches off device features the app never uses", async ({ request }) => {
    const policy = (await request.get("/")).headers()["permissions-policy"];

    for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });
});

test("the session is hidden from scripts in the page", async ({ page, context }) => {
  const email = await createAccount("cookies");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/studio$/);

  const session = (await context.cookies()).filter((cookie) => cookie.name.startsWith("sb-"));
  expect(session.length).toBeGreaterThan(0);
  for (const cookie of session) {
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
  }
  expect(await page.evaluate(() => document.cookie)).not.toContain("sb-");
});

test.describe("coming back from Google", () => {
  test("says sign-up is closed when the sign-in service refused a new account", async ({
    page,
  }) => {
    await page.goto(
      "/auth/callback?error=access_denied&error_description=Sign-up+is+closed.+Knitwright+is+not+open+to+new+accounts+yet.",
    );

    await expect(page).toHaveURL(/\/sign-in\?notice=sign-up-closed$/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Sign-up is closed");
  });

  test("does not show text that came in the address", async ({ page }) => {
    await page.goto("/auth/callback?error=x&error_description=%3Cb%3Einjected%3C%2Fb%3E");

    await expect(page).toHaveURL(/\/sign-in\?notice=google-failed$/);
    await expect(page.getByText("injected")).toHaveCount(0);
  });
});

test("a return from Google that this browser never started leads back to sign-in", async ({
  page,
}) => {
  await page.goto("/auth/callback?code=not-a-real-code");

  await expect(page).toHaveURL(/\/sign-in\?notice=google-failed$/);
});

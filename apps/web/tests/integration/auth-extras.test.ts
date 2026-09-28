import { afterEach, describe, expect, it } from "vitest";
import { isSignupOpen } from "@/lib/auth/queries";
import { finishGoogleSignIn, startGoogleSignIn, type AuthContext } from "@/lib/auth/service";
import { AppError } from "@/lib/server/core/errors";
import { createAdminClient, createSessionClient } from "@/lib/supabase/clients";
import { adminClient, anonClient, cookieJar, must, settings, uniqueEmail } from "./support";

const SITE = "http://localhost:3000";

const visitor = (ownerEmail?: string): AuthContext => ({
  supabase: createSessionClient(settings(), cookieJar()),
  admin: createAdminClient(settings()),
  siteUrl: SITE,
  ownerEmail,
});

const setOpen = async (open: boolean) =>
  must(await adminClient().rpc("set_signup_open", { p_open: open }));

describe("isSignupOpen", () => {
  afterEach(async () => {
    await setOpen(false);
  });

  it("follows the switch", async () => {
    await setOpen(false);
    expect(await isSignupOpen(anonClient())).toBe(false);

    await setOpen(true);
    expect(await isSignupOpen(anonClient())).toBe(true);
  });

  it("answers closed when the question cannot be asked", async () => {
    const unreachable = createSessionClient(
      { ...settings(), NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1" },
      cookieJar(),
    );

    expect(await isSignupOpen(unreachable)).toBe(false);
  });
});

describe("sign-in with Google", () => {
  it("sends the browser to the sign-in service, which returns it to the app's callback", async () => {
    const url = new URL(await startGoogleSignIn(visitor()));

    expect(url.origin).toBe(new URL(settings().NEXT_PUBLIC_SUPABASE_URL).origin);
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_to")).toBe(`${SITE}/auth/callback`);
  });

  it("puts the owner's address on the allowed list before leaving, since the address is not known yet", async () => {
    const owner = uniqueEmail("google-owner");

    await startGoogleSignIn(visitor(owner));

    const { error } = await anonClient().auth.signUp({
      email: owner,
      password: "correct-horse-battery",
      options: { captchaToken: "local-test-token" },
    });
    expect(error).toBeNull();
  });

  it("refuses a code it did not issue", async () => {
    await expect(finishGoogleSignIn(visitor(), "not-a-real-code")).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

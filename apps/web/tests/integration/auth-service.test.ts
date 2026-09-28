import { beforeAll, describe, expect, it } from "vitest";
import {
  confirmLink,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  updatePassword,
  type AuthContext,
} from "@/lib/auth/service";
import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { AppError } from "@/lib/server/core/errors";
import { readSession } from "@/lib/server/session";
import { createAdminClient, createSessionClient } from "@/lib/supabase/clients";
import {
  adminClient,
  CAPTCHA_TOKEN,
  cookieJar,
  createConfirmedUser,
  linkFromMail,
  mailFor,
  must,
  PASSWORD,
  settings,
  uniqueEmail,
  userExists,
} from "./support";

const SITE = "http://localhost:3000";
const captcha = { [CAPTCHA_FIELD]: CAPTCHA_TOKEN };

/** A visitor with their own cookies, as one browser would be. */
const visitor = (ownerEmail?: string) => {
  const jar = cookieJar();
  const context: AuthContext = {
    supabase: createSessionClient(settings(), jar),
    admin: createAdminClient(settings()),
    siteUrl: SITE,
    ownerEmail,
  };
  return { jar, context, session: () => readSession(createSessionClient(settings(), jar)) };
};

const allow = async (email: string) =>
  must(await adminClient().rpc("allow_signup_email", { p_email: email, p_note: "test" }));

const tokenOf = (link: URL) => ({
  token_hash: link.searchParams.get("token_hash") ?? "",
  type: link.searchParams.get("type") as "email" | "recovery",
});

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

describe("auth service", () => {
  beforeAll(async () => {
    must(await adminClient().rpc("set_signup_open", { p_open: false }));
  });

  describe("signUp", () => {
    it("sends a link to the app's own confirm page and signs nobody in", async () => {
      const email = uniqueEmail("new");
      await allow(email);
      const { context, session } = visitor();

      await signUp(context, { email, ...captcha });
      const link = await linkFromMail(email, /confirm/i);

      expect(`${link.origin}${link.pathname}`).toBe(`${SITE}/auth/confirm`);
      expect(link.searchParams.get("type")).toBe("email");
      expect(await session()).toBeNull();
    });

    it("creates no account for a new address while sign-up is closed, and answers the same", async () => {
      const email = uniqueEmail("closed");

      await expect(signUp(visitor().context, { email, ...captcha })).resolves.toBeUndefined();

      expect(await userExists(email)).toBe(false);
      expect(await mailFor(email)).toHaveLength(0);
    });

    it("lets the owner's address register while sign-up is closed", async () => {
      const email = uniqueEmail("owner");

      await signUp(visitor(email).context, { email, ...captcha });

      expect(await userExists(email)).toBe(true);
    });

    it("does not open the door to anyone else because an owner is configured", async () => {
      const stranger = uniqueEmail("stranger");

      await signUp(visitor(uniqueEmail("owner")).context, { email: stranger, ...captcha });

      expect(await userExists(stranger)).toBe(false);
    });

    it("answers the same for an address that already has an account, and sends a sign-in link", async () => {
      const email = await createConfirmedUser("existing");

      await expect(signUp(visitor().context, { email, ...captcha })).resolves.toBeUndefined();

      const link = await linkFromMail(email, /sign in/i);
      expect(`${link.origin}${link.pathname}`).toBe(`${SITE}/auth/confirm`);
    });

    it("answers the same when asked twice in a row", async () => {
      const email = uniqueEmail("twice");
      await allow(email);
      const { context } = visitor();

      await signUp(context, { email, ...captcha });

      await expect(signUp(context, { email, ...captcha })).resolves.toBeUndefined();
    });
  });

  describe("confirmLink", () => {
    it("signs a new person in and asks them to choose a password", async () => {
      const email = uniqueEmail("confirm");
      await allow(email);
      const { context, session } = visitor();
      await signUp(context, { email, ...captcha });

      const next = await confirmLink(context, tokenOf(await linkFromMail(email, /confirm/i)));

      expect(next).toBe("choose-password");
      expect(await session()).toMatchObject({ email });
    });

    it("takes someone who already has a password straight in", async () => {
      const email = uniqueEmail("returning");
      await allow(email);
      const first = visitor();
      await signUp(first.context, { email, ...captcha });
      await confirmLink(first.context, tokenOf(await linkFromMail(email, /confirm/i)));
      await updatePassword(first.context, { password: PASSWORD });
      await signOut(first.context);

      const second = visitor();
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await signUp(second.context, { email, ...captcha });
      const next = await confirmLink(
        second.context,
        tokenOf(await linkFromMail(email, /sign in/i)),
      );

      expect(next).toBe("signed-in");
      expect(await second.session()).toMatchObject({ email });
    });

    it("works once", async () => {
      const email = uniqueEmail("once");
      await allow(email);
      const { context } = visitor();
      await signUp(context, { email, ...captcha });
      const token = tokenOf(await linkFromMail(email, /confirm/i));
      await confirmLink(context, token);

      const failure = await failureOf(confirmLink(visitor().context, token));

      expect(failure.message).toMatch(/expired or was already used/);
    });

    it("refuses a token it never issued", async () => {
      const failure = await failureOf(
        confirmLink(visitor().context, { token_hash: "not-a-real-token", type: "email" }),
      );

      expect(failure.code).toBe("invalid_input");
    });
  });

  describe("signIn", () => {
    it("signs in with the right password", async () => {
      const email = await createConfirmedUser("signin");
      const { context, session } = visitor();

      await signIn(context, { email, password: PASSWORD, ...captcha });

      expect(await session()).toMatchObject({ email });
    });

    it("refuses the wrong password and an unknown address with the same words", async () => {
      const email = await createConfirmedUser("wrong");

      const wrongPassword = await failureOf(
        signIn(visitor().context, { email, password: "not-the-password", ...captcha }),
      );
      const unknownAddress = await failureOf(
        signIn(visitor().context, {
          email: uniqueEmail("nobody"),
          password: PASSWORD,
          ...captcha,
        }),
      );

      expect(wrongPassword.code).toBe("unauthenticated");
      expect(unknownAddress.message).toBe(wrongPassword.message);
    });

    it("refuses an account that has not chosen a password yet, with the same words", async () => {
      const email = uniqueEmail("no-password");
      await allow(email);
      const { context, session } = visitor();
      await signUp(context, { email, ...captcha });

      const failure = await failureOf(signIn(context, { email, password: PASSWORD, ...captcha }));

      expect(failure.message).toBe("That email and password do not match.");
      expect(await session()).toBeNull();
    });
  });

  describe("session cookies", () => {
    it("are hidden from scripts, and sent over https only on an https site", async () => {
      const email = await createConfirmedUser("cookies");
      const jar = cookieJar();
      const context: AuthContext = {
        supabase: createSessionClient(settings("https://app.knitwright.test"), jar),
        admin: createAdminClient(settings()),
        siteUrl: "https://app.knitwright.test",
      };

      await signIn(context, { email, password: PASSWORD, ...captcha });

      expect(jar.size()).toBeGreaterThan(0);
      for (const options of jar.options()) {
        expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
      }
    });
  });

  describe("signOut", () => {
    it("ends the session and clears its cookies", async () => {
      const email = await createConfirmedUser("signout");
      const { context, session, jar } = visitor();
      await signIn(context, { email, password: PASSWORD, ...captcha });

      await signOut(context);

      expect(await session()).toBeNull();
      expect(jar.size()).toBe(0);
    });
  });

  describe("password reset", () => {
    it("sends a link, and the new password then works while the old one does not", async () => {
      const email = await createConfirmedUser("reset");
      const { context, session } = visitor();

      await requestPasswordReset(context, { email, ...captcha });
      const link = await linkFromMail(email, /reset/i);
      const next = await confirmLink(context, tokenOf(link));
      await updatePassword(context, { password: "a-brand-new-password" });
      await signOut(context);

      expect(`${link.origin}${link.pathname}`).toBe(`${SITE}/auth/confirm`);
      expect(next).toBe("choose-password");
      const old = await failureOf(
        signIn(visitor().context, { email, password: PASSWORD, ...captcha }),
      );
      expect(old.code).toBe("unauthenticated");
      await signIn(context, { email, password: "a-brand-new-password", ...captcha });
      expect(await session()).toMatchObject({ email });
    });

    it("answers the same for an unknown address, and sends nothing", async () => {
      const email = uniqueEmail("unknown");

      await expect(
        requestPasswordReset(visitor().context, { email, ...captcha }),
      ).resolves.toBeUndefined();

      expect(await mailFor(email)).toHaveLength(0);
    });

    it("answers the same when asked twice in a row, so it cannot be used to find accounts", async () => {
      const known = await createConfirmedUser("known");
      const unknown = uniqueEmail("unknown");
      const { context } = visitor();

      for (const email of [known, known, unknown, unknown]) {
        await expect(requestPasswordReset(context, { email, ...captcha })).resolves.toBeUndefined();
      }
    });

    it("refuses to change a password when nobody is signed in", async () => {
      const failure = await failureOf(
        updatePassword(visitor().context, { password: "a-brand-new-password" }),
      );

      expect(failure.code).toBe("unauthenticated");
    });
  });
});

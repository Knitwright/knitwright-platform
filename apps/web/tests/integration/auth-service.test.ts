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

/** Registers, confirms by mail and signs out again. */
const confirmedUser = async (label: string): Promise<string> => {
  const email = uniqueEmail(label);
  await allow(email);
  const { context } = visitor();
  await signUp(context, { email, password: PASSWORD, ...captcha });
  await confirmLink(context, tokenOf(await linkFromMail(email, /confirm/i)));
  await signOut(context);
  return email;
};

describe("auth service", () => {
  beforeAll(async () => {
    must(await adminClient().rpc("set_signup_open", { p_open: false }));
  });

  describe("signUp", () => {
    it("creates the account and sends a link to the app's own confirm page", async () => {
      const email = uniqueEmail("new");
      await allow(email);
      const { context, session } = visitor();

      await signUp(context, { email, password: PASSWORD, ...captcha });
      const link = await linkFromMail(email, /confirm/i);

      expect(`${link.origin}${link.pathname}`).toBe(`${SITE}/auth/confirm`);
      expect(link.searchParams.get("type")).toBe("email");
      expect(await session()).toBeNull();
    });

    it("refuses a new address while sign-up is closed", async () => {
      const email = uniqueEmail("closed");
      const { context } = visitor();

      const failure = await failureOf(signUp(context, { email, password: PASSWORD, ...captcha }));

      expect(failure.code).toBe("forbidden");
      expect(failure.message).toMatch(/sign-up is closed/i);
      expect(await userExists(email)).toBe(false);
    });

    it("lets the owner's address register while sign-up is closed", async () => {
      const email = uniqueEmail("owner");
      const { context } = visitor(email);

      await signUp(context, { email, password: PASSWORD, ...captcha });

      expect(await userExists(email)).toBe(true);
    });

    it("does not open the door to anyone else because an owner is configured", async () => {
      const { context } = visitor(uniqueEmail("owner"));
      const stranger = uniqueEmail("stranger");

      const failure = await failureOf(
        signUp(context, { email: stranger, password: PASSWORD, ...captcha }),
      );

      expect(failure.code).toBe("forbidden");
    });

    it("answers the same for an address that already has an account, and sends no second link", async () => {
      const email = await confirmedUser("existing");
      const before = (await mailFor(email)).length;
      const { context } = visitor();

      await expect(
        signUp(context, { email, password: "another-long-password", ...captcha }),
      ).resolves.toBeUndefined();

      expect((await mailFor(email)).length).toBe(before);
    });
  });

  describe("confirmLink", () => {
    it("signs the visitor in", async () => {
      const email = uniqueEmail("confirm");
      await allow(email);
      const { context, session } = visitor();
      await signUp(context, { email, password: PASSWORD, ...captcha });

      const kind = await confirmLink(context, tokenOf(await linkFromMail(email, /confirm/i)));

      expect(kind).toBe("email");
      expect(await session()).toMatchObject({ email });
    });

    it("works once", async () => {
      const email = uniqueEmail("once");
      await allow(email);
      const { context } = visitor();
      await signUp(context, { email, password: PASSWORD, ...captcha });
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
      const email = await confirmedUser("signin");
      const { context, session } = visitor();

      await signIn(context, { email, password: PASSWORD, ...captcha });

      expect(await session()).toMatchObject({ email });
    });

    it("refuses the wrong password and an unknown address with the same words", async () => {
      const email = await confirmedUser("wrong");

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

    it("refuses an account whose address is not confirmed", async () => {
      const email = uniqueEmail("unconfirmed");
      await allow(email);
      const { context, session } = visitor();
      await signUp(context, { email, password: PASSWORD, ...captcha });

      const failure = await failureOf(signIn(context, { email, password: PASSWORD, ...captcha }));

      expect(failure.message).toMatch(/confirm your email/i);
      expect(await session()).toBeNull();
    });
  });

  describe("signOut", () => {
    it("ends the session and clears its cookies", async () => {
      const email = await confirmedUser("signout");
      const { context, session, jar } = visitor();
      await signIn(context, { email, password: PASSWORD, ...captcha });

      await signOut(context);

      expect(await session()).toBeNull();
      expect(jar.size()).toBe(0);
    });
  });

  describe("password reset", () => {
    it("sends a link, and the new password then works while the old one does not", async () => {
      const email = await confirmedUser("reset");
      const { context, session } = visitor();

      await requestPasswordReset(context, { email, ...captcha });
      const link = await linkFromMail(email, /reset/i);
      const kind = await confirmLink(context, tokenOf(link));
      await updatePassword(context, { password: "a-brand-new-password" });
      await signOut(context);

      expect(`${link.origin}${link.pathname}`).toBe(`${SITE}/auth/confirm`);
      expect(kind).toBe("recovery");
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

    it("refuses to change a password when nobody is signed in", async () => {
      const failure = await failureOf(
        updatePassword(visitor().context, { password: "a-brand-new-password" }),
      );

      expect(failure.code).toBe("unauthenticated");
    });
  });
});

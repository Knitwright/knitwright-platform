import { describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  CAPTCHA_TOKEN,
  createConfirmedUser,
  linkFromMail,
  must,
  PASSWORD,
  uniqueEmail,
} from "./support";

/**
 * The rule: a password chosen before an address is confirmed does not survive
 * confirmation.
 *
 * Without it, anyone could register somebody else's address with a password of their
 * own choosing, wait for the real owner to press "confirm" in the email, and then sign
 * in with that password. The sign-in service itself allows this, so the database
 * removes the password at the moment of confirmation.
 */

const captcha = { captchaToken: CAPTCHA_TOKEN };
const ATTACKER_PASSWORD = "attacker-chose-this";

const allow = async (email: string) =>
  must(await adminClient().rpc("allow_signup_email", { p_email: email, p_note: "test" }));

const canSignIn = async (email: string, password: string): Promise<boolean> => {
  const { error } = await anonClient().auth.signInWithPassword({
    email,
    password,
    options: captcha,
  });
  return error === null;
};

const startSignUp = async (email: string) =>
  anonClient().auth.signInWithOtp({
    email,
    options: { ...captcha, shouldCreateUser: true },
  });

const confirm = async (email: string) => {
  const link = await linkFromMail(email, /confirm/i);
  return anonClient().auth.verifyOtp({
    type: "email",
    token_hash: link.searchParams.get("token_hash") ?? "",
  });
};

describe("a password chosen before confirmation", () => {
  it("stops working once the real owner confirms the address", async () => {
    const email = uniqueEmail("pre-registered");
    await allow(email);

    // Someone registers the owner's address with a password of their own.
    const attacker = await anonClient().auth.signUp({
      email,
      password: ATTACKER_PASSWORD,
      options: captcha,
    });
    expect(attacker.error).toBeNull();

    // The owner presses the button in the email.
    expect((await confirm(email)).error).toBeNull();

    expect(await canSignIn(email, ATTACKER_PASSWORD)).toBe(false);
  });

  it("cannot be added to an account that is waiting to be confirmed", async () => {
    const email = uniqueEmail("waiting");
    await allow(email);
    expect((await startSignUp(email)).error).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await anonClient().auth.signUp({ email, password: ATTACKER_PASSWORD, options: captcha });
    expect((await confirm(email)).error).toBeNull();

    expect(await canSignIn(email, ATTACKER_PASSWORD)).toBe(false);
  });

  it("does not work before confirmation either", async () => {
    const email = uniqueEmail("unconfirmed");
    await allow(email);
    await anonClient().auth.signUp({ email, password: ATTACKER_PASSWORD, options: captcha });

    expect(await canSignIn(email, ATTACKER_PASSWORD)).toBe(false);
  });
});

describe("a password chosen after confirmation", () => {
  it("works, and keeps working", async () => {
    const email = uniqueEmail("confirmed");
    await allow(email);
    await startSignUp(email);
    const { data, error } = await confirm(email);
    expect(error).toBeNull();

    const asOwner = anonClient();
    await asOwner.auth.setSession({
      access_token: data.session?.access_token ?? "",
      refresh_token: data.session?.refresh_token ?? "",
    });
    expect((await asOwner.auth.updateUser({ password: PASSWORD })).error).toBeNull();

    expect(await canSignIn(email, PASSWORD)).toBe(true);
    expect(await canSignIn(email, PASSWORD)).toBe(true);
  });

  it("can be set by the server for an account it created", async () => {
    const email = await createConfirmedUser("server-made");

    expect(await canSignIn(email, PASSWORD)).toBe(true);
  });
});

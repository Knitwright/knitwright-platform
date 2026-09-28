import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adminClient, anonClient, must, signUp, uniqueEmail, userExists } from "./support";

const setOpen = async (open: boolean) =>
  must(await adminClient().rpc("set_signup_open", { p_open: open }));

const allow = async (email: string, note = "test") =>
  must(await adminClient().rpc("allow_signup_email", { p_email: email, p_note: note }));

const isOpen = async (): Promise<boolean> => must(await anonClient().rpc("signup_is_open"));

// These tests change one shared switch, so the file runs in order and restores it.
describe("sign-up switch", () => {
  beforeEach(async () => {
    await setOpen(false);
  });

  afterEach(async () => {
    await setOpen(false);
  });

  it("is closed by default", async () => {
    expect(await isOpen()).toBe(false);
  });

  it("refuses a new address while closed, and creates no user", async () => {
    const email = uniqueEmail("closed");

    const error = await signUp(email);

    expect(error).toMatch(/sign-up is closed/i);
    expect(await userExists(email)).toBe(false);
  });

  it("lets an allowed address register while closed", async () => {
    const email = uniqueEmail("owner");
    await allow(email, "owner");

    expect(await signUp(email)).toBeNull();
    expect(await userExists(email)).toBe(true);
  });

  it("matches an allowed address whatever its letter case", async () => {
    const email = uniqueEmail("Mixed.Case");
    await allow(email.toUpperCase());

    expect(await signUp(email)).toBeNull();
  });

  it("lets anyone register while open", async () => {
    await setOpen(true);
    const email = uniqueEmail("open");

    expect(await isOpen()).toBe(true);
    expect(await signUp(email)).toBeNull();
  });

  it("leaves only the secret key able to create a user past the switch", async () => {
    const email = uniqueEmail("admin-made");

    const { error } = await anonClient().auth.admin.createUser({
      email,
      password: "correct-horse-battery",
      email_confirm: true,
    });

    expect(error).not.toBeNull();
    expect(await userExists(email)).toBe(false);
  });

  it("cannot be opened from a browser", async () => {
    const { error } = await anonClient().rpc("set_signup_open", { p_open: true });

    expect(error).not.toBeNull();
    expect(await isOpen()).toBe(false);
  });

  it("does not let a browser add itself to the allowed addresses", async () => {
    const email = uniqueEmail("sneaky");

    const { error } = await anonClient().rpc("allow_signup_email", {
      p_email: email,
      p_note: "self",
    });

    expect(error).not.toBeNull();
    expect(await signUp(email)).toMatch(/sign-up is closed/i);
  });

  it("cannot be bypassed by calling the hook function directly", async () => {
    const { error } = await anonClient().rpc("hook_before_user_created", { event: {} });
    expect(error).not.toBeNull();
  });
});

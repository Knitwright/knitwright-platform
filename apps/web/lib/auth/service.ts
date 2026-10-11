import type { SupabaseClient } from "@supabase/supabase-js";
import { signupConsentData } from "@/lib/consent/consent";
import { MARKETING_FIELD } from "@/lib/consent/schemas";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { answersTheSameOnEmailPaths, authFailure } from "./failures";
import {
  CAPTCHA_FIELD,
  type ConfirmLink,
  type Credentials,
  type EmailOnly,
  type NewPassword,
  type Registration,
} from "./schemas";

/**
 * Sign-up, sign-in and password reset. Each function takes what it needs as arguments
 * and throws an AppError in words the user can read. The server actions in actions.ts
 * call these with the request's own clients.
 *
 * Two rules shape this file:
 * 1. A password is chosen only after the address is confirmed. Registration takes an
 *    address alone, so nobody can attach a password to an address they do not own.
 * 2. The paths that send email answer the same whether or not the address has an
 *    account, so they cannot be used to find out who is registered.
 */

export type AuthContext = Readonly<{
  /** Acts as the visitor. Holds the request's session cookies. */
  supabase: SupabaseClient;
  /** Full access. Used for the allowed list and to record that a password was chosen. */
  admin: SupabaseClient;
  siteUrl: string;
  ownerEmail?: string;
}>;

/** Where a confirmed link leads next. */
export type AfterConfirm = "choose-password" | "signed-in";

const LINK_UNUSABLE = "That link has expired or was already used. Ask for a new one.";

/** Every link in an email leads here. The page decides what happens next by its type. */
const confirmUrl = (siteUrl: string): string => new URL("/auth/confirm", siteUrl).toString();

/** The owner may register while sign-up is closed. Safe to call on every attempt. */
export const ensureOwnerAllowed = async (context: AuthContext): Promise<void> => {
  if (!context.ownerEmail) return;
  const { error } = await context.admin.rpc("allow_signup_email", {
    p_email: context.ownerEmail,
    p_note: "owner",
  });
  if (error) throw new Error("Could not allow the owner's address.", { cause: error });
};

/**
 * Sends a link to the address. A new address gets a link that confirms it. An address
 * that already has an account gets a link that signs it in. An address that may not
 * register gets nothing. The caller is told the same in all three cases.
 *
 * The marketing choice travels with a new account and is recorded by the database when the
 * account is made. An existing account's choice is not changed here: that is done in Settings.
 */
export const signUp = async (context: AuthContext, input: Registration): Promise<void> => {
  if (input.email === context.ownerEmail) await ensureOwnerAllowed(context);

  const { error } = await context.supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: true,
      data: signupConsentData(input[MARKETING_FIELD] === "yes"),
      captchaToken: input[CAPTCHA_FIELD],
      emailRedirectTo: confirmUrl(context.siteUrl),
    },
  });
  if (error && !answersTheSameOnEmailPaths(error)) throw authFailure(error);
};

export const signIn = async (context: AuthContext, input: Credentials): Promise<void> => {
  const { error } = await context.supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
    options: { captchaToken: input[CAPTCHA_FIELD] },
  });
  if (error) throw authFailure(error);
};

export const signOut = async (context: AuthContext): Promise<void> => {
  // "local" ends this browser's session and leaves the user's other devices signed in.
  const { error } = await context.supabase.auth.signOut({ scope: "local" });
  if (error) throw authFailure(error);
};

export const requestPasswordReset = async (
  context: AuthContext,
  input: EmailOnly,
): Promise<void> => {
  const { error } = await context.supabase.auth.resetPasswordForEmail(input.email, {
    captchaToken: input[CAPTCHA_FIELD],
    redirectTo: confirmUrl(context.siteUrl),
  });
  if (error && !answersTheSameOnEmailPaths(error)) throw authFailure(error);
};

/** Exchanges the token from an emailed link for a session. */
export const confirmLink = async (
  context: AuthContext,
  input: ConfirmLink,
): Promise<AfterConfirm> => {
  const { data, error } = await context.supabase.auth.verifyOtp({
    type: input.type,
    token_hash: input.token_hash,
  });

  if (error) {
    const failure = authFailure(error);
    // Any refusal of a token means the same to the user: the link cannot be used.
    throw failure.code === "internal" ? failure : new AppError("invalid_input", LINK_UNUSABLE);
  }

  const hasPassword = data.user?.app_metadata?.password_set === true;
  return input.type === "email" && hasPassword ? "signed-in" : "choose-password";
};

export const updatePassword = async (context: AuthContext, input: NewPassword): Promise<void> => {
  const { data } = await context.supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) throw new AppError("unauthenticated", MESSAGES.unauthenticated);

  const { error } = await context.supabase.auth.updateUser({ password: input.password });
  if (error) throw authFailure(error);

  // Only the server can write this note, so a user cannot claim a password they lack.
  const noted = await context.admin.auth.admin.updateUserById(userId, {
    app_metadata: { password_set: true },
  });
  if (noted.error) throw authFailure(noted.error);
};

/** Starts sign-in with Google. Returns the address to send the browser to. */
export const startGoogleSignIn = async (context: AuthContext): Promise<string> => {
  await ensureOwnerAllowed(context);

  const { data, error } = await context.supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback", context.siteUrl).toString(),
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) throw authFailure(error);
  return data.url;
};

/** Finishes sign-in with Google by exchanging the code for a session. Returns the user's id. */
export const finishGoogleSignIn = async (context: AuthContext, code: string): Promise<string> => {
  const { data, error } = await context.supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) throw authFailure(error);
  return data.user.id;
};

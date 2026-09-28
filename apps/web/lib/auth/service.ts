import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { authFailure } from "./failures";
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
 */

export type AuthContext = Readonly<{
  /** Acts as the visitor. Holds the request's session cookies. */
  supabase: SupabaseClient;
  /** Full access. Used only to put the owner's address on the allowed list. */
  admin: SupabaseClient;
  siteUrl: string;
  ownerEmail?: string;
}>;

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

export const signUp = async (context: AuthContext, input: Registration): Promise<void> => {
  if (input.email === context.ownerEmail) await ensureOwnerAllowed(context);

  const { error } = await context.supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      captchaToken: input[CAPTCHA_FIELD],
      emailRedirectTo: confirmUrl(context.siteUrl),
    },
  });
  // An address that already has an account gets the same answer as a new one, so the
  // form cannot be used to find out who is registered.
  if (error && error.code !== "user_already_exists") throw authFailure(error);
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
  if (error) throw authFailure(error);
};

/** Exchanges the token from an emailed link for a session. Returns the kind of link. */
export const confirmLink = async (
  context: AuthContext,
  input: ConfirmLink,
): Promise<ConfirmLink["type"]> => {
  const { error } = await context.supabase.auth.verifyOtp({
    type: input.type,
    token_hash: input.token_hash,
  });
  if (!error) return input.type;

  const failure = authFailure(error);
  // Any refusal of a token means the same to the user: the link cannot be used.
  throw failure.code === "internal"
    ? failure
    : new AppError("invalid_input", "That link has expired or was already used. Ask for a new one.");
};

export const updatePassword = async (context: AuthContext, input: NewPassword): Promise<void> => {
  const { data } = await context.supabase.auth.getClaims();
  if (!data?.claims) throw new AppError("unauthenticated", MESSAGES.unauthenticated);

  const { error } = await context.supabase.auth.updateUser({ password: input.password });
  if (error) throw authFailure(error);
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

/** Finishes sign-in with Google by exchanging the code for a session. */
export const finishGoogleSignIn = async (context: AuthContext, code: string): Promise<void> => {
  const { error } = await context.supabase.auth.exchangeCodeForSession(code);
  if (error) throw authFailure(error);
};

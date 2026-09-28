import { AppError, MESSAGES } from "@/lib/server/core/errors";

/**
 * Turns an error from the sign-in service into words for the user. The raw message is
 * shown only for the closed sign-up notice, which the database hook writes itself.
 */

type AuthErrorLike = Readonly<{ code?: string; message: string; status?: number }>;

const SIGNUP_CLOSED = /^sign-up is closed/i;

const isAuthErrorLike = (error: unknown): error is AuthErrorLike =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string";

const KNOWN: Readonly<Record<string, () => AppError>> = {
  invalid_credentials: () =>
    new AppError("unauthenticated", "That email and password do not match."),
  email_not_confirmed: () =>
    new AppError(
      "unauthenticated",
      "Confirm your email first. We sent you a link when you signed up.",
    ),
  captcha_failed: () => new AppError("invalid_input", "The check did not pass. Try it again."),
  weak_password: () =>
    new AppError("invalid_input", MESSAGES.invalid_input, {
      password: ["Choose a longer or less common password."],
    }),
  same_password: () =>
    new AppError("invalid_input", MESSAGES.invalid_input, {
      password: ["Choose a password you have not used here before."],
    }),
  otp_expired: () =>
    new AppError("invalid_input", "That link has expired or was already used. Ask for a new one."),
  over_request_rate_limit: () => new AppError("rate_limited", MESSAGES.rate_limited),
  over_email_send_rate_limit: () => new AppError("rate_limited", MESSAGES.rate_limited),
  session_not_found: () => new AppError("unauthenticated", MESSAGES.unauthenticated),
  session_expired: () => new AppError("unauthenticated", MESSAGES.unauthenticated),
  reauthentication_needed: () =>
    new AppError("unauthenticated", "Sign in again before changing your password."),
};

export const authFailure = (error: unknown): AppError => {
  if (!isAuthErrorLike(error)) return new AppError("internal", MESSAGES.internal);
  if (SIGNUP_CLOSED.test(error.message)) return new AppError("forbidden", error.message);
  const known = error.code ? KNOWN[error.code] : undefined;
  return known ? known() : new AppError("internal", MESSAGES.internal);
};

import { AppError, MESSAGES } from "@/lib/server/core/errors";

/**
 * Turns an error from the sign-in service into words for the user. The raw message is
 * never shown.
 */

type AuthErrorLike = Readonly<{ code?: string; message: string; status?: number }>;

const SIGNUP_CLOSED = /^sign-up is closed/i;
const SIGNUP_CLOSED_MESSAGE = "Sign-up is closed. Knitwright is not open to new accounts yet.";
const NO_MATCH = "That email and password do not match.";

const isAuthErrorLike = (error: unknown): error is AuthErrorLike =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string";

/** True when the database hook refused a new account because sign-up is closed. */
export const isSignupClosed = (error: unknown): boolean =>
  isAuthErrorLike(error) && SIGNUP_CLOSED.test(error.message);

/**
 * Answers that differ by whether an address has an account. On the paths that send
 * email (sign-up and password reset) the app gives its usual answer instead, so those
 * forms cannot be used to find out who is registered.
 */
const REVEALING_CODES = new Set(["user_already_exists", "over_email_send_rate_limit"]);

export const answersTheSameOnEmailPaths = (error: unknown): boolean =>
  isAuthErrorLike(error) &&
  (isSignupClosed(error) || (error.code !== undefined && REVEALING_CODES.has(error.code)));

const googleUnfinished = () =>
  new AppError("invalid_input", "Sign-in with Google did not finish. Start again.");

const KNOWN: Readonly<Record<string, () => AppError>> = {
  // The return from Google did not match a sign-in this browser started: the link was
  // opened in another browser, opened twice, or left too long.
  pkce_code_verifier_not_found: googleUnfinished,
  flow_state_not_found: googleUnfinished,
  flow_state_expired: googleUnfinished,
  bad_code_verifier: googleUnfinished,
  bad_oauth_callback: googleUnfinished,
  bad_oauth_state: googleUnfinished,
  invalid_credentials: () => new AppError("unauthenticated", NO_MATCH),
  // The same words as a wrong password, so the state of an address is not revealed.
  email_not_confirmed: () => new AppError("unauthenticated", NO_MATCH),
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
  if (isSignupClosed(error)) return new AppError("forbidden", SIGNUP_CLOSED_MESSAGE);
  const known = isAuthErrorLike(error) && error.code ? KNOWN[error.code] : undefined;
  // An error with no entry above is kept as the cause, so the wrapper can log it.
  return known ? known() : new AppError("internal", MESSAGES.internal, undefined, { cause: error });
};

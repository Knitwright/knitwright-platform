/**
 * Checks a Cloudflare Turnstile token on the server. Signing in and signing up hand the token to
 * Supabase, which checks it; a share page has no account, so the app checks it itself.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TIMEOUT_MS = 5_000;

export type Send = (url: string, init?: RequestInit) => Promise<Response>;

export type BotCheckOutcome = "passed" | "failed" | "unreachable";

interface BotCheckRequest {
  readonly send: Send;
  readonly secret: string;
  readonly token: string;
  /** The visitor's address, as the rate limit reads it. "unknown" or empty leaves it out. */
  readonly address: string;
}

/** Passed only on a clear yes from Cloudflare. A fault on Cloudflare's side is told apart, so the form can say so. */
export async function verifyBotCheck(request: BotCheckRequest): Promise<BotCheckOutcome> {
  const body = new URLSearchParams({ secret: request.secret, response: request.token });
  if (request.address && request.address !== "unknown") body.set("remoteip", request.address);
  let answer: unknown;
  try {
    const response = await request.send(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return "unreachable";
    answer = await response.json();
  } catch {
    return "unreachable";
  }
  return typeof answer === "object" && answer !== null && (answer as { success?: unknown }).success === true ? "passed" : "failed";
}

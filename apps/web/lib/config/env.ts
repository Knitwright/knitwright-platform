import { z } from "zod";
import { DEFAULT_MODEL, DEFAULT_RETRY_MODEL, MODEL_IDS } from "@/lib/providers/catalog";

/**
 * Environment contract. Every variable the app reads is declared here, so a
 * missing or malformed value stops the server at start-up with one message
 * instead of failing later inside a request.
 */
/** A whole, non-negative amount of microdollars, written as digits. */
const microdollars = z.string().regex(/^\d{1,15}$/).transform(Number);

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  // Only the project's address, such as https://abc.supabase.co. The client adds /rest/v1 and
  // the rest itself, so a path here sends every call to a wrong one (PGRST125).
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine((value) => {
    const url = new URL(value);
    return url.pathname === "/" && url.search === "" && url.hash === "";
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Full database access. Read on the server only, never sent to a browser.
  SUPABASE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  // Signs the unsubscribe links in marketing email. Server only. A key of its own, so that
  // changing SUPABASE_SECRET_KEY never breaks a link already sent (the Spam Act wants them to work
  // for 30 days after sending). Required where real people visit; on this machine and in tests the
  // links are signed from SUPABASE_SECRET_KEY instead.
  UNSUBSCRIBE_SECRET: z.string().min(32).optional(),
  // The Turnstile secret, for the bot check the app makes itself on share pages (decision 0026).
  // Sign-in and sign-up hand their token to Supabase, which holds its own copy. Server only.
  // Optional: on this machine Cloudflare's always-pass test secret stands in; where real people
  // visit, share pages refuse answers until it is set.
  TURNSTILE_SECRET_KEY: z.string().regex(/^\S{1,200}$/).optional(),
  // May register while sign-up is closed. The switch itself lives in the database.
  OWNER_EMAIL: z
    .email()
    .transform((value) => value.toLowerCase())
    .optional(),
  // The header in which the host writes the caller's address. No other header is
  // trusted. The default is right for Vercel. Locally it is x-real-ip.
  CLIENT_ADDRESS_HEADER: z
    .string()
    .regex(/^[A-Za-z0-9-]+$/)
    .transform((value) => value.toLowerCase())
    .default("x-vercel-forwarded-for"),
  // AI spend allowances for each calendar month (UTC), in microdollars (millionths of a US
  // dollar). A limit stored in usage_limits for one user or brand replaces these. The
  // defaults are provisional (30 times the earlier daily ones): the owner sets the real
  // ones (see lib/usage/OWNER-QUESTIONS.md).
  USAGE_USER_MONTHLY_AI: microdollars.default(7_500_000),
  USAGE_BRAND_MONTHLY_AI: microdollars.default(30_000_000),
  USAGE_USER_MONTHLY_PHOTOREAL: microdollars.default(15_000_000),
  USAGE_BRAND_MONTHLY_PHOTOREAL: microdollars.default(60_000_000),
  // Safety ceiling across every user for each UTC day (not a month: it guards against a
  // runaway spend). The owner is alerted at half and at full.
  USAGE_GLOBAL_DAILY_CEILING: microdollars.default(25_000_000),
  // AI provider keys (owner action A3). Both are optional: without the key for the chosen
  // model the assistant is shown as not available, and requests the rules can answer still work.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  // The model tried first, and the stronger one tried once before a question is asked.
  // Chosen by the selection run in docs/evals (owed until the keys exist).
  INTENT_MODEL: z.enum(MODEL_IDS).default(DEFAULT_MODEL),
  INTENT_RETRY_MODEL: z.enum(MODEL_IDS).default(DEFAULT_RETRY_MODEL),
  // The image model for photoreal pictures (plan step 14). Optional: without it the
  // feature is shown as unavailable. Server only. It must belong to a Google project with
  // billing on: on the free tier Google may train on what is sent. See docs/data-processing.md.
  GEMINI_API_KEY: z.string().regex(/^\S{1,200}$/).optional(),
  // The same image model resold by fal.ai (owner's choice, 2026-10-13). Optional. Server only.
  // fal's terms do not rule out training on de-identified data; see docs/data-processing.md.
  FAL_KEY: z.string().regex(/^\S{1,200}$/).optional(),
  // Lifestyle pictures and clips (decision 0057). All optional, server only: with LIFESTYLE_SCENE_PROVIDER and
  // LIFESTYLE_TRYON_PROVIDER unset no lifestyle picture is made, and a chosen provider whose key is missing is left out and named.
  LIFESTYLE_SCENE_PROVIDER: z.string().regex(/^[a-z-]{1,40}$/).optional(),
  LIFESTYLE_TRYON_PROVIDER: z.string().regex(/^[a-z-]{1,40}$/).optional(),
  LIFESTYLE_DAILY_CAP_MICRODOLLARS: z.string().regex(/^\d{1,15}$/).optional(),
  PHOTOROOM_API_KEY: z.string().regex(/^\S{1,200}$/).optional(),
  FASHN_API_KEY: z.string().regex(/^\S{1,200}$/).optional(),
  GOOGLE_VERTEX_ACCESS_TOKEN: z.string().regex(/^\S{1,4000}$/).optional(),
  GOOGLE_VERTEX_PROJECT: z.string().regex(/^\S{1,200}$/).optional(),
  GOOGLE_VERTEX_LOCATION: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
  // The WhatsApp Business Cloud API, which tells a factory its job packet link (decision 0072). Both optional
  // and server only: without both, lib/job-packet/notify.ts answers with the stub and ops sends the link itself.
  // Never set where tests run: no test calls WhatsApp for real.
  WHATSAPP_TOKEN: z.string().regex(/^\S{1,400}$/).optional(),
  WHATSAPP_PHONE_ID: z.string().regex(/^\d{1,30}$/).optional(),
  // Paid video from fal runs only when this is exactly "true" and FAL_KEY is set (lib/media/video/select.ts).
  MEDIA_VIDEO_LIVE: z.string().regex(/^\S{1,20}$/).optional(),
  // Signs the assistant's proposals (lib/projects/assistant.ts). Optional: without it the key is derived from
  // SUPABASE_SECRET_KEY as before. Set a dedicated one so rotating the service key does not invalidate proposals.
  ASSISTANT_SIGNING_KEY: z.string().min(32).optional(),
  // Who drafts sewing patterns. "claude-bridge": the owner's own Claude session picks the
  // requests up and drafts them through FashionInsta. Where real people visit it is open to
  // OWNER_EMAIL alone (lib/patterns/access.ts). Unset: patterns are shown as not available yet.
  // FashionInsta's own API will be a third value once there is one.
  PATTERN_PROVIDER: z.enum(["claude-bridge"]).optional(),
  // Which image provider to use when both keys are set. Without it Google directly comes first.
  IMAGE_PROVIDER: z.enum(["gemini", "fal"]).optional(),
  // Browser tests only: "on" answers the assistant with a stand-in that never reaches the
  // network (lib/providers/stand-in.ts). Refused wherever real people sign in.
  AI_PROVIDER_STUB: z.enum(["on", "off"]).optional(),
  // The button is shown only when this is exactly "true".
  GOOGLE_SIGN_IN: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  // The 3D view in the editor (a trial, decision 0014) is shown only when this is exactly
  // "true". Off for the beta (decision 0027); its code stays.
  SHOW_3D: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  // Credits are charged for the full tech pack PDF, pattern files, print files and photoreal
  // images only when this is exactly "true" (decision 0051). Off: nothing is charged, and each
  // output that would cost credits is written to the log. The owner switches it on once prices are set.
  CREDITS_ENFORCED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  // Read only to refuse Cloudflare's test keys where real people sign in.
  NODE_ENV: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
});

/**
 * Cloudflare's published Turnstile test site keys. They pass (or fail) everyone, so
 * they may never reach a deploy.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TURNSTILE_TEST_SITE_KEYS: ReadonlySet<string> = new Set([
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
]);

/** Cloudflare's published Turnstile test secrets: pass, fail, and "token already spent". */
const TURNSTILE_TEST_SECRETS: ReadonlySet<string> = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

const TURNSTILE_PASSING_TEST_SECRET = "1x0000000000000000000000000000000AA";

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * A Vercel production deploy, or a production build served anywhere but this machine.
 * `next start` always runs as production, so the browser tests, which serve the build
 * on localhost, are told apart by their address.
 */
export const servesRealPeople = (env: Pick<z.infer<typeof envSchema>, "VERCEL_ENV" | "NODE_ENV" | "NEXT_PUBLIC_SITE_URL">): boolean =>
  env.VERCEL_ENV === "production" ||
  (env.NODE_ENV === "production" && !LOOPBACK_HOSTS.has(new URL(env.NEXT_PUBLIC_SITE_URL).hostname));

const guardedSchema = envSchema.superRefine((env, context) => {
  if (TURNSTILE_TEST_SITE_KEYS.has(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && servesRealPeople(env)) {
    context.addIssue({
      code: "custom",
      path: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
      message: "test key",
    });
  }
  if (env.TURNSTILE_SECRET_KEY && TURNSTILE_TEST_SECRETS.has(env.TURNSTILE_SECRET_KEY) && servesRealPeople(env)) {
    context.addIssue({ code: "custom", path: ["TURNSTILE_SECRET_KEY"], message: "test key" });
  }
  if (!env.UNSUBSCRIBE_SECRET && servesRealPeople(env)) {
    context.addIssue({ code: "custom", path: ["UNSUBSCRIBE_SECRET"], message: "missing" });
  }
  if (env.PATTERN_PROVIDER === "claude-bridge" && !env.OWNER_EMAIL && servesRealPeople(env)) {
    // On a live site the bridge is the owner's own test, so it needs to know who the owner is.
    context.addIssue({ code: "custom", path: ["PATTERN_PROVIDER"], message: "needs OWNER_EMAIL" });
  }
  if (env.AI_PROVIDER_STUB === "on" && servesRealPeople(env)) {
    context.addIssue({ code: "custom", path: ["AI_PROVIDER_STUB"], message: "test key" });
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * The secret for the app's own bot checks: the one that is set, Cloudflare's always-pass test
 * secret on this machine and in tests, or null where real people visit and none is set.
 */
export const turnstileSecret = (env: Env): string | null =>
  env.TURNSTILE_SECRET_KEY ?? (servesRealPeople(env) ? null : TURNSTILE_PASSING_TEST_SECRET);

/**
 * The secret unsubscribe links are signed from: the one that is set, or the server's secret key on
 * this machine and in tests. Where real people visit the first is always set: parseEnv refuses to
 * start without it.
 */
export const unsubscribeSecret = (env: Env): string => env.UNSUBSCRIBE_SECRET ?? env.SUPABASE_SECRET_KEY;

export class EnvError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `Invalid environment. Fix these variables and restart:\n${problems
        .map((problem) => `  - ${problem}`)
        .join("\n")}`,
    );
    this.name = "EnvError";
  }
}

type EnvSource = Readonly<Record<string, string | undefined>>;

const withoutEmptyStrings = (source: EnvSource): EnvSource =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));

/** Values are never included in problems: a malformed secret must not reach a log. */
const describeIssue = (issue: z.core.$ZodIssue): string => {
  const name = issue.path.join(".") || "(root)";
  if (issue.code === "custom" && issue.message === "missing") return `${name} is missing`;
  if (issue.code === "custom" && name === "PATTERN_PROVIDER") return `${name}=claude-bridge needs OWNER_EMAIL on a deploy, so only the owner can use it`;
  if (issue.code === "custom" && name === "NEXT_PUBLIC_SUPABASE_URL") return `${name} is not valid: give only the address, such as https://abc.supabase.co, with nothing after it`;
  if (issue.code === "custom" && name === "AI_PROVIDER_STUB") return `${name} is for browser tests, which a deploy may not use`;
  if (issue.code === "custom") return `${name} is a test key, which a deploy may not use`;
  const missing = issue.code === "invalid_type" && issue.input === undefined;
  return missing ? `${name} is missing` : `${name} is not valid`;
};

export const parseEnv = (source: EnvSource): Env => {
  const result = guardedSchema.safeParse(withoutEmptyStrings(source));
  if (!result.success) {
    throw new EnvError(result.error.issues.map(describeIssue));
  }
  return result.data;
};

/**
 * A line for the log when a production server starts with CREDITS_ENFORCED unset: unlock and the other credit-gated
 * outputs are then free (security review L5). Null otherwise.
 */
export const creditsNotEnforcedWarning = (source: EnvSource): string | null =>
  source.NODE_ENV === "production" && source.CREDITS_ENFORCED === undefined
    ? "CREDITS_ENFORCED is not set, so credit-gated outputs (unlock, tech pack PDF, pattern and print files, photoreal images) are free. Set it to true or false on purpose before launch."
    : null;

let cached: Env | undefined;

export const getEnv = (): Env => {
  if (cached === undefined) {
    cached = parseEnv(process.env);
    const warning = creditsNotEnforcedWarning(process.env);
    if (warning) console.warn(warning);
  }
  return cached;
};

/**
 * The secret assistant proposals are signed from: ASSISTANT_SIGNING_KEY when it is set, else the derivation used before
 * the variable existed (the server's secret key), so proposals already issued stay valid.
 */
export const assistantSigningSecret = (env: Env): string => env.ASSISTANT_SIGNING_KEY ?? env.SUPABASE_SECRET_KEY;

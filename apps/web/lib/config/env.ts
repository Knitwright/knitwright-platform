import { z } from "zod";

/**
 * Environment contract. Every variable the app reads is declared here, so a
 * missing or malformed value stops the server at start-up with one message
 * instead of failing later inside a request.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  // Full database access. Read on the server only, never sent to a browser.
  SUPABASE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
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
  // The button is shown only when this is exactly "true".
  GOOGLE_SIGN_IN: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

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
  const missing = issue.code === "invalid_type" && issue.input === undefined;
  return missing ? `${name} is missing` : `${name} is not valid`;
};

export const parseEnv = (source: EnvSource): Env => {
  const result = envSchema.safeParse(withoutEmptyStrings(source));
  if (!result.success) {
    throw new EnvError(result.error.issues.map(describeIssue));
  }
  return result.data;
};

let cached: Env | undefined;

export const getEnv = (): Env => {
  cached ??= parseEnv(process.env);
  return cached;
};

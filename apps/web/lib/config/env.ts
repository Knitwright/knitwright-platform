import { z } from "zod";

/**
 * Environment contract. Every variable the app reads is declared here, so a
 * missing or malformed value stops the server at start-up with one message
 * instead of failing later inside a request.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  // Registration stays closed unless this is exactly "true".
  SIGNUP_OPEN: z
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

import { z } from "zod";

/** The field name the Turnstile widget adds to a form. */
export const CAPTCHA_FIELD = "cf-turnstile-response";

export const PASSWORD_MIN = 10;
/** Passwords are hashed with bcrypt, which ignores everything after 72 bytes. */
export const PASSWORD_MAX = 72;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter an email address, like name@brand.com.").max(320));

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

const captcha = z
  .string("Complete the check to show you are a person.")
  .min(1, "Complete the check to show you are a person.")
  .max(4096);

export const registrationSchema = z.object({
  email,
  password: newPassword,
  [CAPTCHA_FIELD]: captcha,
});

export const credentialsSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
  [CAPTCHA_FIELD]: captcha,
});

export const emailOnlySchema = z.object({
  email,
  [CAPTCHA_FIELD]: captcha,
});

export const newPasswordSchema = z.object({
  password: newPassword,
});

export const confirmLinkSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["email", "recovery"]),
});

export type Registration = z.output<typeof registrationSchema>;
export type Credentials = z.output<typeof credentialsSchema>;
export type EmailOnly = z.output<typeof emailOnlySchema>;
export type NewPassword = z.output<typeof newPasswordSchema>;
export type ConfirmLink = z.output<typeof confirmLinkSchema>;

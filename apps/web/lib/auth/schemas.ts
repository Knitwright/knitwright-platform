import { z } from "zod";

/** The field name the Turnstile widget adds to a form. */
export const CAPTCHA_FIELD = "cf-turnstile-response";

export const PASSWORD_MIN = 10;
/** Passwords are hashed with bcrypt, which ignores everything after 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;

const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter an email address, like name@brand.com.").max(320));

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .refine(
    (value) => byteLength(value) <= PASSWORD_MAX_BYTES,
    "That password is too long. Use a shorter one.",
  );

const captcha = z
  .string("Complete the check to show you are a person.")
  .min(1, "Complete the check to show you are a person.")
  .max(4096);

/**
 * Registration takes an address only. The password is chosen after the address is
 * confirmed, so nobody can attach a password to an address they do not own.
 */
export const registrationSchema = z.object({
  email,
  [CAPTCHA_FIELD]: captcha,
});

export const credentialsSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(1024),
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

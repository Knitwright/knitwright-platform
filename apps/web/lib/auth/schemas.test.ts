import { describe, expect, it } from "vitest";
import {
  CAPTCHA_FIELD,
  confirmLinkSchema,
  credentialsSchema,
  emailOnlySchema,
  newPasswordSchema,
  registrationSchema,
} from "./schemas";

const captcha = { [CAPTCHA_FIELD]: "token" };

describe("registrationSchema", () => {
  const valid = { email: "maker@example.com", ...captcha };

  it("accepts an address and a completed check", () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });

  it("takes no password: one is chosen after the address is confirmed", () => {
    const parsed = registrationSchema.parse({ ...valid, password: "correct-horse-battery" });
    expect(parsed).not.toHaveProperty("password");
  });

  it("trims the address and lowers its case", () => {
    const parsed = registrationSchema.parse({ ...valid, email: "  Maker@Example.COM " });
    expect(parsed.email).toBe("maker@example.com");
  });

  it("rejects an address that is not an email address", () => {
    expect(registrationSchema.safeParse({ ...valid, email: "maker" }).success).toBe(false);
  });

  it("requires the bot check", () => {
    const result = registrationSchema.safeParse({ email: valid.email });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual([CAPTCHA_FIELD]);
  });
});

describe("credentialsSchema", () => {
  it("does not apply the length rule when signing in, so old passwords still work", () => {
    expect(
      credentialsSchema.safeParse({ email: "maker@example.com", password: "short", ...captcha })
        .success,
    ).toBe(true);
  });

  it("requires a password", () => {
    expect(
      credentialsSchema.safeParse({ email: "maker@example.com", password: "", ...captcha }).success,
    ).toBe(false);
  });
});

describe("emailOnlySchema", () => {
  it("accepts an address and a completed check", () => {
    expect(emailOnlySchema.safeParse({ email: "maker@example.com", ...captcha }).success).toBe(
      true,
    );
  });
});

describe("newPasswordSchema", () => {
  it("accepts a long password", () => {
    expect(newPasswordSchema.safeParse({ password: "correct-horse-battery" }).success).toBe(true);
  });

  it("rejects a password shorter than 10 characters, in plain words", () => {
    const result = newPasswordSchema.safeParse({ password: "short" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Use at least 10 characters.");
  });

  it("accepts a password of exactly 72 bytes and rejects one of 73", () => {
    expect(newPasswordSchema.safeParse({ password: "x".repeat(72) }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "x".repeat(73) }).success).toBe(false);
  });

  it("counts bytes, not characters, because that is what is cut short when stored", () => {
    // 30 characters, 90 bytes.
    const result = newPasswordSchema.safeParse({ password: "密".repeat(30) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("That password is too long. Use a shorter one.");
  });

  it("does not trim a password, since spaces may be part of it", () => {
    const parsed = newPasswordSchema.parse({ password: "  spaced password  " });
    expect(parsed.password).toBe("  spaced password  ");
  });
});

describe("confirmLinkSchema", () => {
  it("accepts the two kinds of link the app sends", () => {
    expect(confirmLinkSchema.safeParse({ token_hash: "abc", type: "email" }).success).toBe(true);
    expect(confirmLinkSchema.safeParse({ token_hash: "abc", type: "recovery" }).success).toBe(true);
  });

  it("rejects any other kind", () => {
    expect(confirmLinkSchema.safeParse({ token_hash: "abc", type: "invite" }).success).toBe(false);
  });

  it("rejects a token that is missing or far too long", () => {
    expect(confirmLinkSchema.safeParse({ token_hash: "", type: "email" }).success).toBe(false);
    expect(
      confirmLinkSchema.safeParse({ token_hash: "x".repeat(513), type: "email" }).success,
    ).toBe(false);
  });
});

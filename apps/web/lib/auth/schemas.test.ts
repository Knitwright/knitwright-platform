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
  const valid = { email: "maker@example.com", password: "correct-horse-battery", ...captcha };

  it("accepts an address, a long password and a completed check", () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the address and lowers its case", () => {
    const parsed = registrationSchema.parse({ ...valid, email: "  Maker@Example.COM " });
    expect(parsed.email).toBe("maker@example.com");
  });

  it("rejects an address that is not an email address", () => {
    expect(registrationSchema.safeParse({ ...valid, email: "maker" }).success).toBe(false);
  });

  it("rejects a password shorter than 10 characters, in plain words", () => {
    const result = registrationSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Use at least 10 characters.");
  });

  it("rejects a password longer than 72 characters, which would be cut short when stored", () => {
    expect(registrationSchema.safeParse({ ...valid, password: "x".repeat(73) }).success).toBe(
      false,
    );
  });

  it("does not trim a password, since spaces may be part of it", () => {
    const parsed = registrationSchema.parse({ ...valid, password: "  spaced password  " });
    expect(parsed.password).toBe("  spaced password  ");
  });

  it("requires the bot check", () => {
    const result = registrationSchema.safeParse({ email: valid.email, password: valid.password });
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
  it("applies the same length rule as registration", () => {
    expect(newPasswordSchema.safeParse({ password: "short" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "correct-horse-battery" }).success).toBe(true);
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

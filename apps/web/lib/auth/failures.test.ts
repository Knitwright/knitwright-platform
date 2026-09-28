import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { authFailure } from "./failures";

const supabaseError = (code: string | undefined, message: string, status = 400) =>
  Object.assign(new Error(message), { code, status, name: "AuthApiError" });

const failure = (code: string | undefined, message = "raw message", status = 400) =>
  authFailure(supabaseError(code, message, status));

describe("authFailure", () => {
  it("gives one answer for a wrong address and a wrong password, so neither is revealed", () => {
    const result = failure("invalid_credentials", "Invalid login credentials");
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe("unauthenticated");
    expect(result.message).toBe("That email and password do not match.");
  });

  it("asks for confirmation when the address is not confirmed yet", () => {
    expect(failure("email_not_confirmed").message).toBe(
      "Confirm your email first. We sent you a link when you signed up.",
    );
  });

  it("explains a closed sign-up in the hook's own words", () => {
    const result = failure(
      "hook_payload_invalid",
      "Sign-up is closed. Knitwright is not open to new accounts yet.",
      403,
    );
    expect(result.code).toBe("forbidden");
    expect(result.message).toBe("Sign-up is closed. Knitwright is not open to new accounts yet.");
  });

  it("recognises a closed sign-up by its message when the code differs", () => {
    expect(failure(undefined, "Sign-up is closed. Knitwright is not open yet.", 403).code).toBe(
      "forbidden",
    );
  });

  it("asks for the bot check again when it failed", () => {
    const result = failure("captcha_failed");
    expect(result.code).toBe("invalid_input");
    expect(result.message).toBe("The check did not pass. Try it again.");
  });

  it("names the password field when the password is too weak", () => {
    const result = failure("weak_password");
    expect(result.code).toBe("invalid_input");
    expect(result.fields).toEqual({ password: ["Choose a longer or less common password."] });
  });

  it("refuses the old password as the new one", () => {
    expect(failure("same_password").fields).toEqual({
      password: ["Choose a password you have not used here before."],
    });
  });

  it("explains a link that was already used or has expired", () => {
    expect(failure("otp_expired").message).toBe(
      "That link has expired or was already used. Ask for a new one.",
    );
  });

  it("passes on a rate limit from the sign-in service", () => {
    expect(failure("over_request_rate_limit", "rate limited", 429).code).toBe("rate_limited");
    expect(failure("over_email_send_rate_limit", "rate limited", 429).code).toBe("rate_limited");
  });

  it("does not show the raw message of an error it does not know", () => {
    const result = failure("unexpected_failure", "pq: relation does not exist", 500);
    expect(result.code).toBe("internal");
    expect(result.message).not.toContain("relation");
  });

  it("treats something that is not an error object as unknown", () => {
    expect(authFailure("boom").code).toBe("internal");
    expect(authFailure(null).code).toBe("internal");
  });
});

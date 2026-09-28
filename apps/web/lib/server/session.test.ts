import { describe, expect, it } from "vitest";
import { sessionFromClaims } from "./session";

const authError = (name: string, status?: number) =>
  Object.assign(new Error(name), { name, status, __isAuthError: true });

describe("sessionFromClaims", () => {
  it("reads the user id and address from verified claims", () => {
    expect(
      sessionFromClaims({
        data: { claims: { sub: "user-1", email: "maker@example.com" } },
        error: null,
      }),
    ).toEqual({ userId: "user-1", email: "maker@example.com" });
  });

  it("has no address when the claims carry none", () => {
    expect(sessionFromClaims({ data: { claims: { sub: "user-1" } }, error: null })).toEqual({
      userId: "user-1",
      email: null,
    });
  });

  it("is signed out when there are no claims", () => {
    expect(sessionFromClaims({ data: null, error: null })).toBeNull();
  });

  it("is signed out when the claims name no user", () => {
    expect(sessionFromClaims({ data: { claims: { sub: "" } }, error: null })).toBeNull();
    expect(sessionFromClaims({ data: { claims: {} }, error: null })).toBeNull();
  });

  it("is signed out when the session is missing or the token is not valid", () => {
    expect(
      sessionFromClaims({ data: null, error: authError("AuthSessionMissingError", 400) }),
    ).toBeNull();
    expect(
      sessionFromClaims({ data: null, error: authError("AuthInvalidJwtError", 400) }),
    ).toBeNull();
    expect(sessionFromClaims({ data: null, error: authError("AuthApiError", 403) })).toBeNull();
  });

  it("throws when the sign-in service could not be reached, instead of signing the user out", () => {
    expect(() =>
      sessionFromClaims({ data: null, error: authError("AuthRetryableFetchError", 0) }),
    ).toThrow();
    expect(() =>
      sessionFromClaims({ data: null, error: authError("AuthApiError", 503) }),
    ).toThrow();
  });

  it("never treats an anonymous visitor as a user", () => {
    expect(
      sessionFromClaims({
        data: { claims: { sub: "anon-1", is_anonymous: true } },
        error: null,
      }),
    ).toBeNull();
  });
});

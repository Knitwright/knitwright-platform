import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/server/core/errors";
import { moderationFailure } from "./errors";

describe("what the moderation functions refuse with", () => {
  it("says a conflict in the words its hint names", () => {
    expect(moderationFailure({ message: "x", hint: "invalid_transition" })).toMatchObject({ code: "conflict", message: "This item has already been decided." });
    expect(moderationFailure({ message: "x", hint: "reason_needed" })).toMatchObject({ code: "conflict", message: "Give a reason, up to 500 characters." });
    expect(moderationFailure({ message: "x", hint: "append_only" })).toMatchObject({ code: "conflict", message: "A moderation check can never be changed or removed." });
  });

  it("tells anyone who may not see a row that it is simply not there", () => {
    expect(moderationFailure({ message: "x", code: "P0002" }).code).toBe("not_found");
    expect(moderationFailure({ message: "x", code: "22P02" }).code).toBe("not_found");
  });

  it("asks for another look at the fields when the database refused the shape", () => {
    for (const code of ["22023", "23505", "23514"]) {
      expect(moderationFailure({ message: "x", code }), code).toMatchObject({ code: "invalid_input", message: MESSAGES.invalid_input });
    }
  });

  it("keeps an unexpected failure to itself, and keeps the cause for the log", () => {
    const error = { message: "connection reset", code: "08006" };
    const failure = moderationFailure(error);
    expect(failure).toMatchObject({ code: "internal", message: MESSAGES.internal });
    expect(failure.cause).toBe(error);
  });

  it("reads a hint it does not know as no hint at all", () => {
    expect(moderationFailure({ message: "x", hint: "something_else", code: "P0002" }).code).toBe("not_found");
    expect(moderationFailure({ message: "x", hint: null }).code).toBe("internal");
  });
});

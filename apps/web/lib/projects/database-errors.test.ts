import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { CONFLICT_MESSAGE, failureFromDatabase } from "./database-errors";

describe("failureFromDatabase", () => {
  it("recognises a version conflict by its hint", () => {
    const failure = failureFromDatabase({ code: "P0001", hint: "version_conflict", message: "x" });

    expect(failure).toBeInstanceOf(AppError);
    expect(failure.code).toBe("conflict");
    expect(failure.message).toBe("This design was changed somewhere else. Reload to see the latest version.");
    expect(failure.message).toBe(CONFLICT_MESSAGE);
  });

  it.each(["P0002", "22P02"])("answers not found for %s, so a stranger learns nothing", (code) => {
    const failure = failureFromDatabase({ code, message: "x" });

    expect(failure.code).toBe("not_found");
    expect(failure.message).toBe("That design does not exist.");
  });

  it.each(["28000", "42501"])("answers unauthenticated for %s", (code) => {
    expect(failureFromDatabase({ code, message: "x" }).code).toBe("unauthenticated");
  });

  it("passes on the words of a refused value", () => {
    const failure = failureFromDatabase({ code: "22023", message: "A design name has 1 to 80 characters." });

    expect(failure.code).toBe("invalid_input");
    expect(failure.message).toBe("Some fields need another look.");
  });

  it("keeps the cause of anything else, and says nothing about it", () => {
    const error = { code: "XX000", message: "secret detail" };

    const failure = failureFromDatabase(error);

    expect(failure.code).toBe("internal");
    expect(failure.message).not.toContain("secret");
    expect(failure.cause).toBe(error);
  });

  it("treats an append-only refusal as an internal problem", () => {
    expect(failureFromDatabase({ code: "P0001", hint: "append_only", message: "x" }).code).toBe("internal");
  });
});

import { describe, expect, it, vi } from "vitest";
import { formatLogEvent } from "./log";

describe("formatLogEvent", () => {
  it("writes one line of JSON with the level, the message and the place", () => {
    const line = formatLogEvent({ level: "error", message: "Failed", where: "GET /api/me" });

    expect(JSON.parse(line)).toMatchObject({
      level: "error",
      message: "Failed",
      where: "GET /api/me",
    });
    expect(line).not.toContain("\n");
  });

  it("includes the name, message and stack of an error", () => {
    const line = formatLogEvent({
      level: "error",
      message: "Failed",
      where: "x",
      error: new TypeError("bad value"),
    });

    const parsed = JSON.parse(line);
    expect(parsed.error.name).toBe("TypeError");
    expect(parsed.error.message).toBe("bad value");
    expect(parsed.error.stack).toContain("TypeError");
  });

  it("follows the chain of causes", () => {
    const line = formatLogEvent({
      level: "error",
      message: "Failed",
      where: "x",
      error: new Error("outer", { cause: new Error("inner") }),
    });

    expect(JSON.parse(line).error.cause.message).toBe("inner");
  });

  it("stops following causes that loop back on themselves", () => {
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    first.cause = second;

    expect(() =>
      formatLogEvent({ level: "error", message: "Failed", where: "x", error: first }),
    ).not.toThrow();
  });

  it("describes a thrown value that is not an error", () => {
    const line = formatLogEvent({ level: "warn", message: "Odd", where: "x", error: "boom" });

    expect(JSON.parse(line).error).toEqual({ value: "boom" });
  });

  it("never keeps the details of a database error, which echo row values", () => {
    const database = { code: "23505", message: "duplicate key", details: "Key (email)=(ada@example.com) already exists." };
    const line = formatLogEvent({ level: "error", message: "Failed", where: "x", error: database });

    expect(line).not.toContain("ada@example.com");
    expect(JSON.parse(line).error).toEqual({ code: "23505", message: "duplicate key" });
  });

  it("keeps the code, message and hint of a database error that caused an error", () => {
    const database = {
      code: "42501",
      message: "permission denied for function rate_limit_hit",
      details: "Key (email)=(a@b.example)",
      hint: "Ask with key sb_secret_abc123",
    };
    const error = new Error("The rate limit could not be counted.", { cause: database });

    const cause = JSON.parse(formatLogEvent({ level: "error", message: "Failed", where: "x", error })).error.cause;

    expect(cause).toEqual({
      code: "42501",
      message: "permission denied for function rate_limit_hit",
      hint: "Ask with key [removed]",
    });
  });

  it("keeps only the known fields of an object, never the rest", () => {
    const line = formatLogEvent({ level: "error", message: "Odd", where: "x", error: { status: 401, password: "hunter2" } });

    expect(JSON.parse(line).error).toEqual({ status: 401 });
  });

  it("removes keys and tokens that appear in an error message", () => {
    const line = formatLogEvent({
      level: "error",
      message: "Failed",
      where: "x",
      error: new Error(
        "bad key sb_secret_N7UND0UgjKTVKUodkm0Hg and token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123456",
      ),
    });

    expect(line).not.toContain("sb_secret_N7UND0UgjKTVKUodkm0Hg");
    expect(line).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(line).toContain("[removed]");
  });

  it("removes bearer values, emailed-link tokens and session tokens too", () => {
    const line = formatLogEvent({
      level: "error",
      message: "Failed",
      where: "x",
      error: new Error(
        "Authorization: Bearer opaque-token-123 at /auth/confirm?token_hash=pkce_abc123&type=email access_token=at-456 refresh_token=rt-789",
      ),
    });

    for (const secret of ["opaque-token-123", "pkce_abc123", "at-456", "rt-789"]) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain("type=email");
  });
});

describe("scrub", () => {
  it("is the same cleaning, for text that leaves the server another way", async () => {
    const { scrub } = await import("./log");
    expect(scrub("key sb_secret_abc and Bearer xyz")).toBe("key [removed] and Bearer [removed]");
  });

  it("removes the token of a share link from its address (decision 0026)", async () => {
    const { scrub } = await import("./log");
    const token = "ECxl0lFqlHu2x987PO-qI2j7bf92_gFdkBPlJTdLceI";
    expect(scrub(`GET https://app.knitwright.com/s/${token} failed`)).toBe("GET https://app.knitwright.com/s/[removed] failed");
  });
});

describe("AI provider keys", () => {
  it("are removed from a logged error", () => {
    const line = formatLogEvent({
      level: "error",
      message: "Failed",
      where: "x",
      error: new Error("keys sk-ant-api03-AbCdEf123456_-xyz and sk-proj-ABCDEFGHIJKLMNOPQRSTUV123"),
    });
    expect(line).not.toContain("AbCdEf123456");
    expect(line).not.toContain("ABCDEFGHIJKLMNOPQRSTUV123");
  });
});

describe("log", () => {
  it("writes errors to the error stream and warnings to the output stream", async () => {
    const { log } = await import("./log");
    const written: { stream: string; line: string }[] = [];
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation((line) => {
      written.push({ stream: "stderr", line: String(line) });
      return true;
    });
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((line) => {
      written.push({ stream: "stdout", line: String(line) });
      return true;
    });

    try {
      log({ level: "error", message: "Failed", where: "x" });
      log({ level: "warn", message: "Odd", where: "y" });
    } finally {
      stderr.mockRestore();
      stdout.mockRestore();
    }

    expect(written.map((entry) => entry.stream)).toEqual(["stderr", "stdout"]);
    expect(written.every((entry) => entry.line.endsWith("\n"))).toBe(true);
    expect(JSON.parse(written[0].line).message).toBe("Failed");
  });
});

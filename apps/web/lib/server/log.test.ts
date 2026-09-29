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

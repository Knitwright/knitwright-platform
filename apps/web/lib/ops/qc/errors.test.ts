import { describe, expect, it } from "vitest";
import { qcFailure } from "./errors";

describe("qcFailure", () => {
  it.each([
    ["qc_not_passed", "conflict"],
    ["over_shipped", "conflict"],
    ["not_ready_for_qc", "conflict"],
    ["remake_needed", "invalid_input"],
    ["owner_and_due_needed", "invalid_input"],
  ])("answers %s as %s with words ops can act on", (hint, code) => {
    const failure = qcFailure({ message: "raw", hint });
    expect(failure.code).toBe(code);
    expect(failure.message).not.toBe("raw");
  });

  it("falls back to part 1's answers", () => {
    expect(qcFailure({ message: "x", hint: "not_later" }).code).toBe("conflict");
    expect(qcFailure({ message: "x", code: "P0002" }).code).toBe("not_found");
    expect(qcFailure({ message: "x", code: "XX000" }).code).toBe("internal");
  });
});

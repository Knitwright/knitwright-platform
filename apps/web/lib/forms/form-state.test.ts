import { describe, expect, it } from "vitest";
import type { Result } from "@/lib/server/core/errors";
import { initialFormState, nextFormState, summaryOf, type FormState } from "./form-state";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
};

const noRethrow = () => {};
const start: FormState<string> = initialFormState();

describe("nextFormState", () => {
  it("keeps the action's answer", async () => {
    const answer: Result<string> = { success: true, data: "done" };

    const state = await nextFormState(start, form({}), async () => answer, noRethrow);

    expect(state.result).toEqual(answer);
  });

  it("counts every attempt, so each one gets a fresh bot check", async () => {
    const action = async (): Promise<Result<string>> => ({ success: true, data: "done" });

    const first = await nextFormState(start, form({}), action, noRethrow);
    const second = await nextFormState(first, form({}), action, noRethrow);

    expect([start.attempt, first.attempt, second.attempt]).toEqual([0, 1, 2]);
  });

  it("keeps the address that was typed, so a failed attempt does not empty the form", async () => {
    const state = await nextFormState(
      start,
      form({ email: "maker@example.com" }),
      async () => ({ success: false, error: { code: "invalid_input", message: "No." } }),
      noRethrow,
    );

    expect(state.values).toEqual({ email: "maker@example.com" });
  });

  it("keeps a name that was typed", async () => {
    const state = await nextFormState(
      start,
      form({ name: "Northfield FC" }),
      async () => ({ success: true, data: "saved" }),
      noRethrow,
    );

    expect(state.values).toEqual({ name: "Northfield FC" });
  });

  it("keeps the choices made on the new design form", async () => {
    const state = await nextFormState(
      start,
      form({ typeId: "polo", wearer: "men", styleNumber: "P-1", season: "SS27", name: "Home" }),
      async () => ({ success: false, error: { code: "invalid_input", message: "No." } }),
      noRethrow,
    );

    expect(state.values).toEqual({ typeId: "polo", wearer: "men", styleNumber: "P-1", season: "SS27", name: "Home" });
  });

  it("never keeps a password", async () => {
    const state = await nextFormState(
      start,
      form({ email: "maker@example.com", password: "correct-horse-battery" }),
      async () => ({ success: false, error: { code: "invalid_input", message: "No." } }),
      noRethrow,
    );

    expect(JSON.stringify(state)).not.toContain("correct-horse-battery");
  });

  it("turns a call that could not reach the server into a failure the form can show", async () => {
    const state = await nextFormState(
      start,
      form({ email: "maker@example.com" }),
      async () => {
        throw new TypeError("fetch failed");
      },
      noRethrow,
    );

    expect(state.result).toEqual({
      success: false,
      error: {
        code: "unavailable",
        message: "We could not reach the server. Check your connection and try again.",
      },
    });
    expect(state.attempt).toBe(1);
    expect(state.values).toEqual({ email: "maker@example.com" });
  });

  it("lets the framework's own control flow through, so a redirect still happens", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/studio" });
    const rethrow = (error: unknown) => {
      if (error === redirect) throw error;
    };

    await expect(
      nextFormState(
        start,
        form({}),
        async () => {
          throw redirect;
        },
        rethrow,
      ),
    ).rejects.toBe(redirect);
  });

  it("does not change the state it was given", async () => {
    const frozen = Object.freeze({ ...start, values: Object.freeze({}) });

    await expect(
      nextFormState(frozen, form({}), async () => ({ success: true, data: "x" }), noRethrow),
    ).resolves.toBeDefined();
    expect(frozen.attempt).toBe(0);
  });
});

describe("summaryOf", () => {
  it("has nothing to say before the first attempt or after a success", () => {
    expect(summaryOf(start)).toBeNull();
    expect(summaryOf({ ...start, result: { success: true, data: "x" } })).toBeNull();
  });

  it("gives the failure's message", () => {
    expect(
      summaryOf({
        ...start,
        result: { success: false, error: { code: "forbidden", message: "Not yours." } },
      }),
    ).toBe("Not yours.");
  });

  it("speaks up when only fields failed, so a screen reader hears that something is wrong", () => {
    expect(
      summaryOf({
        ...start,
        result: {
          success: false,
          error: {
            code: "invalid_input",
            message: "Some fields need another look.",
            fields: { password: ["Use at least 10 characters."] },
          },
        },
      }),
    ).toBe("Some fields need another look.");
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDefineAction } from "./create-define-action";
import { AppError } from "./errors";
import { makeDeps, RULE, SESSION } from "./test-deps";

const schema = z.object({ name: z.string().min(1, "Give the design a name.") });

describe("defineAction", () => {
  it("passes validated input and the session to the handler", async () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema,
      handler: async ({ input, session }) => ({ name: input.name, by: session.userId }),
    });

    expect(await action({ name: "Polo" })).toEqual({
      success: true,
      data: { name: "Polo", by: SESSION.userId },
    });
  });

  it("reads a submitted form", async () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema,
      handler: async ({ input }) => input.name,
    });
    const form = new FormData();
    form.set("name", "Raglan jersey");

    expect(await action(form)).toEqual({ success: true, data: "Raglan jersey" });
  });

  it("keeps every value of a repeated form field", async () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: z.object({ size: z.array(z.string()) }),
      handler: async ({ input }) => input.size,
    });
    const form = new FormData();
    form.append("size", "S");
    form.append("size", "M");

    expect(await action(form)).toEqual({ success: true, data: ["S", "M"] });
  });

  it("refuses a file in a form, because uploads have their own helper", async () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: z.object({ name: z.unknown() }),
      handler: async () => "ran",
    });
    const form = new FormData();
    form.set("name", new File(["x"], "x.png"));

    const result = await action(form);

    expect(result).toMatchObject({ success: false, error: { code: "invalid_input" } });
  });

  it("ignores the hidden fields the framework adds to a form", async () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: schema.strict(),
      handler: async ({ input }) => input.name,
    });
    const form = new FormData();
    form.set("$ACTION_ID_abc", "");
    form.set("name", "Polo");

    expect(await action(form)).toEqual({ success: true, data: "Polo" });
  });

  it("refuses a call with no session before the handler runs", async () => {
    const { deps } = makeDeps({ session: null });
    let ran = false;
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema,
      handler: async () => {
        ran = true;
      },
    });

    const result = await action({ name: "Polo" });

    expect(result).toMatchObject({ success: false, error: { code: "unauthenticated" } });
    expect(ran).toBe(false);
  });

  it("lets a public action run without a session", async () => {
    const { deps } = makeDeps({ session: null });
    const action = createDefineAction(deps)({
      auth: "public",
      rateLimit: RULE,
      schema,
      handler: async ({ input }) => input.name,
    });

    expect(await action({ name: "Polo" })).toEqual({ success: true, data: "Polo" });
  });

  it("returns the schema's own message for each invalid field", async () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema,
      handler: async () => "ran",
    });

    expect(await action({ name: "" })).toEqual({
      success: false,
      error: {
        code: "invalid_input",
        message: "Some fields need another look.",
        fields: { name: ["Give the design a name."] },
      },
    });
  });

  it("refuses when the rate limit is reached", async () => {
    const { deps } = makeDeps({ allow: () => false });
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema,
      handler: async () => "ran",
    });

    expect(await action({ name: "Polo" })).toMatchObject({
      success: false,
      error: { code: "rate_limited" },
    });
  });

  it("turns an expected failure into its code and message", async () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema,
      handler: async () => {
        throw new AppError("forbidden", "Sign-up is closed.");
      },
    });

    expect(await action({ name: "Polo" })).toEqual({
      success: false,
      error: { code: "forbidden", message: "Sign-up is closed." },
    });
  });

  it("hides the detail of an unexpected failure and logs it", async () => {
    const { deps, recorded } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema,
      handler: async () => {
        throw new Error("password=hunter2");
      },
    });

    const result = await action({ name: "Polo" });

    expect(JSON.stringify(result)).not.toContain("hunter2");
    expect(result).toMatchObject({ success: false, error: { code: "internal" } });
    expect(recorded.logs).toHaveLength(1);
  });

  it("lets framework control flow, such as a redirect, pass through", async () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "user",
      rateLimit: RULE,
      schema,
      handler: async () => {
        throw new Error("NEXT_REDIRECT");
      },
    });

    await expect(action({ name: "Polo" })).rejects.toThrow("NEXT_REDIRECT");
  });

  it("is an async function, which the framework requires of a server action", () => {
    const { deps } = makeDeps();
    const action = createDefineAction(deps)({
      auth: "public",
      rateLimit: RULE,
      schema,
      handler: async () => "ran",
    });

    expect(action.constructor.name).toBe("AsyncFunction");
  });
});

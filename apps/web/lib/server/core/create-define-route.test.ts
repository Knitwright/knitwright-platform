import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDefineRoute } from "./create-define-route";
import { AppError } from "./errors";
import { makeDeps, RULE, SESSION } from "./test-deps";

const noParams = { params: Promise.resolve({}) };

const post = (body: unknown, init: RequestInit = {}) =>
  new Request("http://localhost/api/thing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });

describe("defineRoute", () => {
  it("passes validated input and the session to the handler", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: { body: z.object({ name: z.string().min(1) }) },
      handler: async ({ input, session }) => ({ name: input.body.name, by: session.userId }),
    });

    const response = await route(post({ name: "Crew tee" }), noParams);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { name: "Crew tee", by: SESSION.userId },
    });
  });

  it("refuses a request with no session before the handler runs", async () => {
    const { deps } = makeDeps({ session: null });
    let ran = false;
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => {
        ran = true;
        return {};
      },
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "unauthenticated" },
    });
    expect(ran).toBe(false);
  });

  it("lets a public route run without a session", async () => {
    const { deps } = makeDeps({ session: null });
    const route = createDefineRoute(deps)({
      auth: "public",
      rateLimit: RULE,
      schema: {},
      handler: async () => ({ ok: true }),
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.status).toBe(200);
  });

  it("rejects a body that does not match the schema and names the field", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: { body: z.object({ name: z.string().min(1) }) },
      handler: async () => ({}),
    });

    const response = await route(post({ name: "" }), noParams);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("invalid_input");
    expect(Object.keys(json.error.fields)).toEqual(["body.name"]);
  });

  it("rejects a body that is not JSON", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: { body: z.object({ name: z.string() }) },
      handler: async () => ({}),
    });

    const response = await route(post("{not json"), noParams);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  });

  it("rejects a body larger than the limit without parsing it", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      maxBodyBytes: 32,
      schema: { body: z.object({ name: z.string() }) },
      handler: async () => ({}),
    });

    const response = await route(post({ name: "x".repeat(100) }), noParams);

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("too_large");
  });

  it("parses query and path parameters", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {
        params: z.object({ id: z.string().min(1) }),
        query: z.object({ page: z.coerce.number().int().min(1) }),
      },
      handler: async ({ input }) => ({ id: input.params.id, page: input.query.page }),
    });

    const response = await route(new Request("http://localhost/api/thing/abc?page=3"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(await response.json()).toEqual({ success: true, data: { id: "abc", page: 3 } });
  });

  it("counts the request against the address and against the user", async () => {
    const { deps, recorded } = makeDeps({ address: "198.51.100.4" });
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => ({}),
    });

    await route(new Request("http://localhost/api/thing"), noParams);

    expect(recorded.hits.map((hit) => hit.key)).toEqual([
      "test:address:198.51.100.4",
      `test:user:${SESSION.userId}`,
    ]);
  });

  it("answers 429 when the address is over its limit and does not run the handler", async () => {
    const { deps } = makeDeps({ allow: (key) => !key.includes(":address:") });
    let ran = false;
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => {
        ran = true;
        return {};
      },
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe(String(RULE.windowSeconds));
    expect((await response.json()).error.code).toBe("rate_limited");
    expect(ran).toBe(false);
  });

  it("answers 429 when the user is over their limit", async () => {
    const { deps } = makeDeps({ allow: (key) => !key.includes(":user:") });
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => ({}),
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.status).toBe(429);
  });

  it("limits before it validates, so invalid requests cannot be sent for free", async () => {
    const { deps } = makeDeps({ allow: () => false });
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: { body: z.object({ name: z.string() }) },
      handler: async () => ({}),
    });

    const response = await route(post("{not json"), noParams);

    expect(response.status).toBe(429);
  });

  it("turns an expected failure into its own status and message", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => {
        throw new AppError("not_found", "That design does not exist.");
      },
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "not_found", message: "That design does not exist." },
    });
  });

  it("hides the detail of an unexpected failure and logs it", async () => {
    const { deps, recorded } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => {
        throw new Error("connection string postgres://secret");
      },
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain("secret");
    expect(JSON.parse(text).error.code).toBe("internal");
    expect(recorded.logs).toHaveLength(1);
  });

  it("answers 500, not 401, when the session store itself fails", async () => {
    const { deps } = makeDeps({ sessionError: new Error("auth server down") });
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => ({}),
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.status).toBe(500);
  });

  it("returns a Response from the handler unchanged", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => new Response("file", { status: 200, headers: { "x-kind": "raw" } }),
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(await response.text()).toBe("file");
    expect(response.headers.get("x-kind")).toBe("raw");
  });

  it("tells caches not to store a JSON answer", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => ({}),
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("lets framework control flow, such as a redirect, pass through", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => {
        throw new Error("NEXT_REDIRECT");
      },
    });

    await expect(route(new Request("http://localhost/api/thing"), noParams)).rejects.toThrow(
      "NEXT_REDIRECT",
    );
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDefineRoute } from "./create-define-route";
import { AppError } from "./errors";
import { BRAND, makeDeps, RULE, SESSION } from "./test-deps";

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

  it("gives a route for members the brand the caller is working in", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "member",
      rateLimit: RULE,
      schema: {},
      handler: async ({ session }) => ({ by: session.userId, brand: session.brand }),
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(await response.json()).toEqual({
      success: true,
      data: { by: SESSION.userId, brand: BRAND },
    });
  });

  it("refuses a caller with no brand before the handler runs", async () => {
    const { deps } = makeDeps({ brand: null });
    let ran = false;
    const route = createDefineRoute(deps)({
      auth: "member",
      rateLimit: RULE,
      schema: {},
      handler: async () => {
        ran = true;
        return {};
      },
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: "no_brand", message: "Create a brand first." },
    });
    expect(ran).toBe(false);
  });

  it("refuses a caller with no session before it looks for a brand", async () => {
    const { deps, recorded } = makeDeps({ session: null });
    const route = createDefineRoute(deps)({
      auth: "member",
      rateLimit: RULE,
      schema: {},
      handler: async () => ({}),
    });

    const response = await route(new Request("http://localhost/api/thing"), noParams);

    expect(response.status).toBe(401);
    expect(recorded.brandLookups).toBe(0);
  });

  it("does not look for a brand when the route does not need one", async () => {
    const { deps, recorded } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: {},
      handler: async () => ({}),
    });

    await route(new Request("http://localhost/api/thing"), noParams);

    expect(recorded.brandLookups).toBe(0);
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

  it("refuses in authorize before the body is read", async () => {
    const { deps } = makeDeps();
    let handled = false;
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: { body: z.object({ name: z.string() }) },
      authorize: async () => {
        throw new AppError("not_found", "Not found.");
      },
      handler: async () => {
        handled = true;
        return {};
      },
    });
    const request = post({ name: "x" });

    const response = await route(request, noParams);

    expect(response.status).toBe(404);
    expect(request.bodyUsed).toBe(false);
    expect(handled).toBe(false);
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

  it("stops reading a body of unknown length once it passes the limit", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      maxBodyBytes: 32,
      schema: { body: z.object({ name: z.string() }) },
      handler: async () => ({}),
    });
    let chunksRead = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksRead += 1;
        controller.enqueue(new TextEncoder().encode("x".repeat(16)));
      },
    });
    // The stream is handed to the route directly. Passed as a Request body, Node's fetch pumps it
    // through a stream of its own, and when the route cancels, that pump can write into the
    // closed stream after the test ends ("ReadableStream is already closed"). No content-length.
    const request = new Request("http://localhost/api/thing", { method: "POST" });
    Object.defineProperty(request, "body", { value: endless });

    const response = await route(request, noParams);

    expect(response.status).toBe(413);
    expect(chunksRead).toBeLessThan(10);
  });

  it("reads a body sent in several pieces", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: { body: z.object({ name: z.string() }) },
      handler: async ({ input }) => input.body.name,
    });
    const pieces = ['{"name":"Cr', 'ew tee é', '"}'];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) controller.enqueue(new TextEncoder().encode(piece));
        controller.close();
      },
    });
    // Handed to the route directly, for the same reason as the endless body above.
    const request = new Request("http://localhost/api/thing", { method: "POST" });
    Object.defineProperty(request, "body", { value: body });

    expect(await (await route(request, noParams)).json()).toEqual({
      success: true,
      data: "Crew tee é",
    });
  });

  it("treats a request with no body as invalid input when a body is expected", async () => {
    const { deps } = makeDeps();
    const route = createDefineRoute(deps)({
      auth: "user",
      rateLimit: RULE,
      schema: { body: z.object({ name: z.string() }) },
      handler: async () => ({}),
    });

    const response = await route(
      new Request("http://localhost/api/thing", { method: "POST" }),
      noParams,
    );

    expect(response.status).toBe(400);
  });

  describe("a form with a file", () => {
    const upload = z.object({ kind: z.enum(["artwork", "sketch"]), file: z.instanceof(File) });

    // The form is encoded to bytes first. Sent as FormData, Node's fetch streams it from a
    // generator that can write into the body after the route has cancelled it (the over-limit
    // test), which surfaces after the test as "ReadableStream is already closed".
    const formRequest = async (fields: Record<string, string | File>) => {
      const form = new FormData();
      for (const [name, value] of Object.entries(fields)) form.set(name, value);
      const encoded = new Response(form);
      return new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-type": encoded.headers.get("content-type") ?? "" },
        body: await encoded.arrayBuffer(),
      });
    };

    const uploadRoute = (maxBodyBytes?: number) => {
      const { deps } = makeDeps();
      return createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        maxBodyBytes,
        schema: { form: upload },
        handler: async ({ input }) => ({
          kind: input.form.kind,
          name: input.form.file.name,
          type: input.form.file.type,
          text: await input.form.file.text(),
        }),
      });
    };

    it("passes the file and the other fields to the handler", async () => {
      const file = new File(["pixels"], "logo.png", { type: "image/png" });

      const response = await uploadRoute()(await formRequest({ kind: "artwork", file }), noParams);

      expect(await response.json()).toEqual({
        success: true,
        data: { kind: "artwork", name: "logo.png", type: "image/png", text: "pixels" },
      });
    });

    it("names the field when the file is missing", async () => {
      const response = await uploadRoute()(await formRequest({ kind: "artwork" }), noParams);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(Object.keys(json.error.fields)).toEqual(["form.file"]);
    });

    it("refuses a field that should be a file but is text", async () => {
      const response = await uploadRoute()(
        await formRequest({ kind: "artwork", file: "not a file" }),
        noParams,
      );

      expect(response.status).toBe(400);
    });

    it("refuses a form larger than the limit", async () => {
      const file = new File(["x".repeat(2000)], "big.png", { type: "image/png" });

      const response = await uploadRoute(1000)(await formRequest({ kind: "artwork", file }), noParams);

      expect(response.status).toBe(413);
    });

    it("refuses a body that is not a form", async () => {
      const response = await uploadRoute()(post({ kind: "artwork" }), noParams);

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("invalid_input");
    });

    it("refuses a body that claims to be a form but is not", async () => {
      const request = new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=xyz" },
        body: "this is not a form",
      });

      const response = await uploadRoute()(request, noParams);

      expect(response.status).toBe(400);
    });
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

  describe("with a cost", () => {
    const COST = { feature: "ai", microdollars: 500 } as const;

    it("reserves the cost for the user and brand before the handler runs", async () => {
      const { deps, recorded } = makeDeps();
      let reservedFirst = false;
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async () => {
          reservedFirst = recorded.reservations.length === 1;
          return { done: true };
        },
      });

      const response = await route(post({}), noParams);

      expect(response.status).toBe(200);
      expect(reservedFirst).toBe(true);
      expect(recorded.reservations).toEqual([
        { userId: SESSION.userId, brandId: BRAND.id, cost: COST, route: "POST /api/thing" },
      ]);
      expect(recorded.refunds).toEqual([]);
    });

    it("tells the handler which reservation paid, so work carried on after the response can refund it", async () => {
      const { deps } = makeDeps();
      let seen: unknown = "not called";
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async ({ usage }) => {
          seen = usage;
          return {};
        },
      });

      await route(post({}), noParams);

      expect(seen).toMatchObject({ eventId: "event-1" });
    });

    it("gives a handler without a cost no reservation", async () => {
      const { deps } = makeDeps();
      let seen: unknown = "not called";
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        handler: async ({ usage }) => {
          seen = usage;
          return {};
        },
      });

      await route(post({}), noParams);

      expect(seen).toBeNull();
    });

    it("works the cost out from the validated input when given a function", async () => {
      const { deps, recorded } = makeDeps();
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: { body: z.object({ images: z.number().int() }) },
        cost: ({ body }) => ({ feature: "photoreal", microdollars: body.images * 11_000 }),
        handler: async () => ({}),
      });

      await route(post({ images: 2 }), noParams);

      expect(recorded.reservations[0].cost).toEqual({ feature: "photoreal", microdollars: 22_000 });
    });

    it("reserves nothing when the input is invalid", async () => {
      const { deps, recorded } = makeDeps();
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: { body: z.object({ name: z.string() }) },
        cost: COST,
        handler: async () => ({}),
      });

      expect((await route(post({ name: 3 }), noParams)).status).toBe(400);
      expect(recorded.reservations).toEqual([]);
    });

    it.each([
      ["user", 429, "over_allowance"],
      ["brand", 429, "over_allowance"],
      ["global", 503, "unavailable"],
    ] as const)("refuses without running the handler at the %s limit", async (by, status, code) => {
      const { deps } = makeDeps({ reserve: () => ({ ok: false, refused: by }) });
      let ran = false;
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async () => {
          ran = true;
          return {};
        },
      });

      const response = await route(post({}), noParams);

      expect(response.status).toBe(status);
      const { error } = (await response.json()) as { error: { code: string; message: string } };
      expect(error.code).toBe(code);
      // Allowances start again each calendar month (owner decision 2026-09-30).
      expect(error.message).toMatch(by === "global" ? /rest of today/ : /this month's allowance.*starts again on 1 /);
      expect(ran).toBe(false);
    });

    it("refunds the cost when the handler throws, and still answers with the failure", async () => {
      const { deps, recorded } = makeDeps();
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async () => {
          throw new AppError("conflict", "The design has moved on.");
        },
      });

      const response = await route(post({}), noParams);

      expect(response.status).toBe(409);
      expect(recorded.refunds).toEqual(["event-1"]);
    });

    it("logs a refund that fails and answers with the handler's failure", async () => {
      const { deps, recorded } = makeDeps({ refundError: new Error("database gone") });
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async () => {
          throw new AppError("conflict", "The design has moved on.");
        },
      });

      const response = await route(post({}), noParams);

      expect(response.status).toBe(409);
      expect(recorded.logs).toEqual([
        expect.objectContaining({ level: "error", message: "A failed call could not be refunded" }),
      ]);
    });

    it("allows a cost only on routes for members, since a brand pays", async () => {
      const { deps, recorded } = makeDeps();
      let ran = false;
      const route = createDefineRoute(deps)({
        auth: "user",
        rateLimit: RULE,
        schema: {},
        // @ts-expect-error A route without a brand has nobody to pay.
        cost: COST,
        handler: async () => {
          ran = true;
          return {};
        },
      });

      expect((await route(post({}), noParams)).status).toBe(500);
      expect(ran).toBe(false);
      expect(recorded.reservations).toEqual([]);
    });

    it("reserves nothing when the cost works out to none, and gives the handler no meter", async () => {
      const { deps, recorded } = makeDeps();
      let usage: unknown = "unset";
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: { body: z.object({ free: z.boolean() }) },
        cost: ({ body }) => (body.free ? null : COST),
        handler: async (context) => {
          usage = context.usage;
          return {};
        },
      });

      expect((await route(post({ free: true }), noParams)).status).toBe(200);
      expect(recorded.reservations).toEqual([]);
      expect(usage).toBeNull();
    });

    it("lets the handler give its cost back once, for work that fails after the answer has started", async () => {
      const { deps, recorded } = makeDeps();
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async ({ usage }) => {
          await usage?.refund();
          await usage?.refund();
          return {};
        },
      });

      await route(post({}), noParams);

      expect(recorded.refunds).toEqual(["event-1"]);
    });

    it("lets the handler reserve a further cost, such as a retry, and give that back on its own", async () => {
      let count = 0;
      const { deps, recorded } = makeDeps({
        reserve: () => {
          count += 1;
          return count < 3 ? { ok: true, eventId: `event-${count}` } : { ok: false, refused: "user" };
        },
      });
      const outcomes: unknown[] = [];
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async ({ usage }) => {
          const extra = await usage?.reserve({ feature: "ai", microdollars: 900 });
          outcomes.push(extra === null ? "refused" : "reserved");
          await extra?.refund();
          outcomes.push((await usage?.reserve(COST)) === null ? "refused" : "reserved");
          return {};
        },
      });

      await route(post({}), noParams);

      expect(outcomes).toEqual(["reserved", "refused"]);
      expect(recorded.reservations.map((entry) => entry.cost.microdollars)).toEqual([500, 900, 500]);
      expect(recorded.refunds).toEqual(["event-2"]);
    });

    it("logs a refund by the handler that fails, without failing the handler", async () => {
      const { deps, recorded } = makeDeps({ refundError: new Error("database gone") });
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async ({ usage }) => {
          await usage?.refund();
          return { fine: true };
        },
      });

      expect((await route(post({}), noParams)).status).toBe(200);
      expect(recorded.logs).toEqual([expect.objectContaining({ message: "A failed call could not be refunded" })]);
    });

    it("answers with an error and runs nothing when the meter cannot reserve", async () => {
      const { deps } = makeDeps({
        reserve: () => {
          throw new Error("meter down");
        },
      });
      let ran = false;
      const route = createDefineRoute(deps)({
        auth: "member",
        rateLimit: RULE,
        schema: {},
        cost: COST,
        handler: async () => {
          ran = true;
          return {};
        },
      });

      expect((await route(post({}), noParams)).status).toBe(500);
      expect(ran).toBe(false);
    });
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

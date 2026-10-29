import { describe, expect, it, vi } from "vitest";
import { createFilesServiceClient } from "./client";
import { ANSWER_SCHEMAS, type FilesService } from "./contract";
import { filesServiceConfigured, filesServiceFrom } from "./index";
import { ESTIMATED_COST, meteredFilesService, type MeterLike } from "./metered";
import { ENGINE_NOTES, FILES_SERVICE_OPERATIONS, isPaid, PAID_OPERATIONS } from "./operations";
import { createStubFilesService, NOT_AVAILABLE, notAvailableMessage } from "./stub";
import { signServiceToken, TOKEN_HEADER, TOKEN_LIFETIME_SECONDS, verifyServiceToken } from "./token";

/**
 * The seam for the future Python service. It is not wired in: the stub is what the platform gets
 * everywhere today. No test reaches the network: `fetch` is passed in.
 */

const NOW = 1_800_000_000;
const CONFIG = { url: "https://files.example.invalid/", secret: "s3cret", nowSeconds: () => NOW };

const okResponse = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("the operation list", () => {
  it("names every operation the spec puts on the Python service, with an engine and a licence note", () => {
    expect(FILES_SERVICE_OPERATIONS).toEqual(["draft_pattern", "read_dxf", "nest_marker", "fit_check", "render_garment", "transfer_design", "composite_logo", "detect_brand_marks"]);
    for (const operation of FILES_SERVICE_OPERATIONS) {
      expect(ENGINE_NOTES[operation].engine, operation).toMatch(/\S/);
      expect(ENGINE_NOTES[operation].licence, operation).toMatch(/\S/);
      expect(ANSWER_SCHEMAS[operation], operation).toBeDefined();
    }
  });

  it("keeps the two models that may not be used commercially out of every endpoint", () => {
    const notes = Object.values(ENGINE_NOTES).map((n) => `${n.engine} ${n.licence}`).join(" ");
    expect(notes).toContain("NOT klein-9b");
    expect(notes).toContain("NOT SegFormer");
    // No engine is named as being one of them.
    for (const note of Object.values(ENGINE_NOTES)) expect(note.engine).not.toMatch(/klein-9b|SegFormer/);
  });

  it("marks the operations that call a commercial model as paid", () => {
    expect(PAID_OPERATIONS).toEqual(["render_garment", "transfer_design", "composite_logo", "detect_brand_marks"]);
    expect(isPaid("nest_marker")).toBe(false);
    expect(isPaid("render_garment")).toBe(true);
    for (const operation of FILES_SERVICE_OPERATIONS) expect(isPaid(operation) === (ESTIMATED_COST[operation] !== null), operation).toBe(true);
  });
});

describe("the stub", () => {
  it("answers 'not available' for the health check and for every operation", async () => {
    const service = createStubFilesService();
    expect(await service.health()).toEqual({ ok: false, failure: "not_available", message: NOT_AVAILABLE });
    for (const operation of FILES_SERVICE_OPERATIONS) {
      // The request shape does not matter: the stub never reads it.
      const answer = await service.call(operation, {} as never);
      expect(answer.ok, operation).toBe(false);
      if (!answer.ok) {
        expect(answer.failure).toBe("not_available");
        expect(answer.message).toContain(NOT_AVAILABLE);
      }
    }
  });

  it("says what each operation will do, so a screen can say why a button is off", () => {
    expect(notAvailableMessage("nest_marker")).toContain("grain constrained");
  });
});

describe("filesServiceFrom", () => {
  it("gives the stub when the address is unset, which it is everywhere today", () => {
    expect(filesServiceFrom({}).name).toBe("files-service-stub");
    expect(filesServiceConfigured({})).toBe(false);
  });

  it("gives the stub when there is an address but no secret, rather than calling an open service", () => {
    expect(filesServiceFrom({ FILES_SERVICE_URL: "https://files.example.invalid" }).name).toBe("files-service-stub");
    expect(filesServiceFrom({ FILES_SERVICE_TOKEN: "s3cret" }).name).toBe("files-service-stub");
    expect(filesServiceConfigured({ FILES_SERVICE_URL: "https://files.example.invalid" })).toBe(false);
  });

  it("gives the HTTP client when both are set", () => {
    expect(filesServiceFrom({ FILES_SERVICE_URL: "https://files.example.invalid", FILES_SERVICE_TOKEN: "s3cret" }).name).toBe("files-service-http");
    expect(filesServiceConfigured({ FILES_SERVICE_URL: "https://files.example.invalid", FILES_SERVICE_TOKEN: "s3cret" })).toBe(true);
  });
});

describe("the service token", () => {
  it("is signed over the operation, the body and an expiry, and verifies", () => {
    const { token, expiresAt } = signServiceToken("s3cret", "nest_marker", '{"a":1}', NOW);
    expect(expiresAt).toBe(NOW + TOKEN_LIFETIME_SECONDS);
    expect(verifyServiceToken("s3cret", token, "nest_marker", '{"a":1}', NOW)).toBe(true);
  });

  it("cannot be replayed as another operation, over another body, or with another secret", () => {
    const { token } = signServiceToken("s3cret", "nest_marker", '{"a":1}', NOW);
    expect(verifyServiceToken("s3cret", token, "render_garment", '{"a":1}', NOW)).toBe(false);
    expect(verifyServiceToken("s3cret", token, "nest_marker", '{"a":2}', NOW)).toBe(false);
    expect(verifyServiceToken("other", token, "nest_marker", '{"a":1}', NOW)).toBe(false);
  });

  it("expires", () => {
    const { token } = signServiceToken("s3cret", "nest_marker", "{}", NOW);
    expect(verifyServiceToken("s3cret", token, "nest_marker", "{}", NOW + TOKEN_LIFETIME_SECONDS)).toBe(true);
    expect(verifyServiceToken("s3cret", token, "nest_marker", "{}", NOW + TOKEN_LIFETIME_SECONDS + 1)).toBe(false);
  });

  it("refuses a token that is not the right shape, and a missing secret", () => {
    expect(verifyServiceToken("s3cret", "nonsense", "nest_marker", "{}", NOW)).toBe(false);
    expect(verifyServiceToken("s3cret", "v1.nest_marker.notanumber.a.b", "nest_marker", "{}", NOW)).toBe(false);
    expect(verifyServiceToken("s3cret", "v2.nest_marker.1.a.b", "nest_marker", "{}", NOW)).toBe(false);
    expect(() => signServiceToken("", "nest_marker", "{}", NOW)).toThrow("FILES_SERVICE_TOKEN");
  });
});

describe("the HTTP client", () => {
  it("posts to /v1/<operation> with a token signed over the body it sends", async () => {
    const fetchFn = vi.fn(async () => okResponse({ markerLengthMm: 3200, markerWidthMm: 1500, utilisation: 0.82, fabricGrams: 720, costMinor: 450, currency: "GBP", marker: null, findings: [] }));
    const service = createFilesServiceClient({ ...CONFIG, fetch: fetchFn as unknown as typeof globalThis.fetch });
    const request = { piecesBySize: { M: { front: 1 } }, fabricWidthMm: 1500, shrinkagePercent: { warp: 2, weft: 1 }, napOneWay: true, fabricGsm: 150, price: { perMetreMinor: 400, perKilogramMinor: null, currency: "GBP" } };
    const answer = await service.call("nest_marker", request);
    expect(answer).toEqual({ ok: true, answer: { markerLengthMm: 3200, markerWidthMm: 1500, utilisation: 0.82, fabricGrams: 720, costMinor: 450, currency: "GBP", marker: null, findings: [] } });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://files.example.invalid/v1/nest_marker");
    expect(init.method).toBe("POST");
    expect(verifyServiceToken("s3cret", init.headers[TOKEN_HEADER], "nest_marker", init.body as string, NOW)).toBe(true);
  });

  it("checks the health endpoint", async () => {
    const fetchFn = vi.fn(async () => okResponse({ service: "knitwright-files", version: "0.1.0", operations: ["nest_marker"] }));
    const answer = await createFilesServiceClient({ ...CONFIG, fetch: fetchFn as unknown as typeof globalThis.fetch }).health();
    expect(answer).toEqual({ ok: true, answer: { service: "knitwright-files", version: "0.1.0", operations: ["nest_marker"] } });
  });

  it("refuses an answer in a shape this version does not know, rather than passing it on", async () => {
    const fetchFn = async () => okResponse({ markerLengthMm: "long" });
    const answer = await createFilesServiceClient({ ...CONFIG, fetch: fetchFn as unknown as typeof globalThis.fetch }).call("nest_marker", {} as never);
    expect(answer).toEqual({ ok: false, failure: "bad_answer", message: "The files service answered in a shape this version does not know." });
  });

  it("refuses an answer that is not JSON", async () => {
    const fetchFn = async () => new Response("<html>", { status: 200 });
    const answer = await createFilesServiceClient({ ...CONFIG, fetch: fetchFn as unknown as typeof globalThis.fetch }).call("nest_marker", {} as never);
    expect(answer).toMatchObject({ ok: false, failure: "bad_answer" });
  });

  it("tells a refusal from a service fault", async () => {
    const at = async (status: number) => {
      const fetchFn = async () => new Response("", { status });
      return createFilesServiceClient({ ...CONFIG, fetch: fetchFn as unknown as typeof globalThis.fetch }).call("nest_marker", {} as never);
    };
    expect(await at(401)).toMatchObject({ ok: false, failure: "refused", message: "The files service refused the service token." });
    expect(await at(422)).toMatchObject({ ok: false, failure: "refused" });
    expect(await at(503)).toMatchObject({ ok: false, failure: "service_error" });
  });

  it("says the service could not be reached, and tells a timeout apart", async () => {
    const unreachable = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await createFilesServiceClient({ ...CONFIG, fetch: unreachable as unknown as typeof globalThis.fetch }).call("nest_marker", {} as never)).toMatchObject({ ok: false, failure: "unreachable" });
    const slow = async () => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    };
    expect(await createFilesServiceClient({ ...CONFIG, fetch: slow as unknown as typeof globalThis.fetch }).call("nest_marker", {} as never)).toMatchObject({ ok: false, failure: "timed_out" });
  });
});

describe("metering on the paid operations", () => {
  const meter = (reserved: boolean): MeterLike & { reserves: unknown[]; refunds: string[] } => {
    const reserves: unknown[] = [];
    const refunds: string[] = [];
    return {
      reserves,
      refunds,
      reserve: async (request) => (reserves.push(request), reserved ? { ok: true, eventId: "ev1" } : { ok: false, refused: "brand" }),
      refund: async (id) => (refunds.push(id), true),
    };
  };

  const answering = (ok: boolean): FilesService => ({
    name: "stand-in",
    health: async () => ({ ok: false, failure: "not_available", message: "x" }),
    call: async () => (ok ? ({ ok: true, answer: { image: { key: "k", bytes: 1, contentType: "image/png" }, appliesToPanels: false, findings: [] } } as never) : { ok: false, failure: "service_error", message: "x" }),
  });

  it("reserves the estimated cost before a paid call", async () => {
    const m = meter(true);
    const answer = await meteredFilesService(answering(true), m, { userId: "u1", brandId: "b1" }).call("composite_logo", {} as never);
    expect(answer.ok).toBe(true);
    expect(m.reserves).toEqual([{ userId: "u1", brandId: "b1", cost: ESTIMATED_COST.composite_logo, route: "files-service/composite_logo" }]);
    expect(m.refunds).toEqual([]);
  });

  it("does not meter an operation that is only our own compute", async () => {
    const m = meter(true);
    await meteredFilesService(createStubFilesService(), m, { userId: "u1", brandId: "b1" }).call("nest_marker", {} as never);
    expect(m.reserves).toEqual([]);
  });

  it("gives the reservation back when the call fails", async () => {
    const m = meter(true);
    const answer = await meteredFilesService(answering(false), m, { userId: "u1", brandId: "b1" }).call("render_garment", {} as never);
    expect(answer.ok).toBe(false);
    expect(m.refunds).toEqual(["ev1"]);
  });

  it("never calls the service when the allowance is used up", async () => {
    const m = meter(false);
    const service = answering(true);
    const called = vi.fn(service.call);
    const answer = await meteredFilesService({ ...service, call: called as typeof service.call }, m, { userId: "u1", brandId: "b1" }).call("render_garment", {} as never);
    expect(answer).toMatchObject({ ok: false, failure: "refused" });
    expect(called).not.toHaveBeenCalled();
  });

  it("passes the health check straight through", async () => {
    const m = meter(true);
    expect(await meteredFilesService(createStubFilesService(), m, { userId: "u1", brandId: "b1" }).health()).toMatchObject({ ok: false, failure: "not_available" });
  });
});

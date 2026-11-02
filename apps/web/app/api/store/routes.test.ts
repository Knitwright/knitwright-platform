import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITS } from "@/lib/server/limits";
import { canonicalQuery, signStoreToken, TOKEN_HEADER } from "@/lib/store-contract/token";
import type { PayloadKind } from "@/lib/store-contract/version";

/**
 * The five Store endpoints (plan v5 O2, decision 0106). `defineRoute` is replaced by one that hands
 * its own config back, so the guard, the limit and the schema can be read and the handler called
 * with the context the framework would build. The reads themselves are `lib/store-contract/server`,
 * which the database test covers; what is proved here is the door.
 *
 * The door is the whole point. These endpoints answer a service and read across brands, so the test
 * that matters most is the one where a signed-in member's own session is present and the answer is
 * still 404: a session is not a key here, and nothing a browser holds opens one.
 */

const SECRET = "s".repeat(32);
const NOW = 1_800_000_000_000;

const state = vi.hoisted(() => ({ secret: undefined as string | undefined, asked: [] as unknown[] }));

vi.mock("@/lib/server/define-route", () => ({ defineRoute: (config: unknown) => config }));
vi.mock("@/lib/store-contract/server", () => ({
  storeSecret: () => state.secret,
  serveManifest: async () => ({ kind: "store-manifest" }),
  serveProducts: async (query: unknown) => {
    state.asked.push(query);
    return { kind: "store-products" };
  },
  serveDrops: async (query: unknown) => {
    state.asked.push(query);
    return { kind: "store-drops" };
  },
  serveListings: async () => ({ kind: "store-listings" }),
  serveTeamStores: async () => ({ kind: "store-team-stores" }),
}));

type Route = {
  auth: string;
  rateLimit: unknown;
  schema: { query?: { safeParse(value: unknown): { success: boolean; data?: unknown } } };
  handler(context: unknown): Promise<Response>;
};

const ENDPOINTS: readonly Readonly<{ kind: PayloadKind; path: string; load: () => Promise<{ GET: unknown }> }>[] = [
  { kind: "store-manifest", path: "/api/store", load: () => import("./route") },
  { kind: "store-products", path: "/api/store/products", load: () => import("./products/route") },
  { kind: "store-drops", path: "/api/store/drops", load: () => import("./drops/route") },
  { kind: "store-listings", path: "/api/store/listings", load: () => import("./listings/route") },
  { kind: "store-team-stores", path: "/api/store/team-stores", load: () => import("./team-stores/route") },
];

const SESSION = { userId: "u1", email: "o@example.com", brand: { id: "b1", name: "Acme FC", role: "owner" } };

const requestFor = (path: string, search: string, token: string | null): Request =>
  new Request(`https://knitwright.test${path}${search}`, {
    headers: token === null ? {} : { [TOKEN_HEADER]: token },
  });

const call = async (
  endpoint: (typeof ENDPOINTS)[number],
  options: Readonly<{ search?: string; signAs?: PayloadKind; token?: string | null; now?: number }> = {},
): Promise<Response> => {
  const search = options.search ?? "";
  const route = (await endpoint.load()).GET as unknown as Route;
  const signed = signStoreToken(SECRET, options.signAs ?? endpoint.kind, canonicalQuery(Object.fromEntries(new URLSearchParams(search).entries())), NOW / 1000);
  const token = options.token === undefined ? signed.token : options.token;
  const request = requestFor(endpoint.path, search, token);
  const parsed = route.schema.query?.safeParse(Object.fromEntries(new URLSearchParams(search).entries()));
  vi.setSystemTime(options.now ?? NOW);
  return route.handler({ input: { query: parsed?.data ?? {} }, session: null, request, usage: null });
};

beforeEach(() => {
  state.secret = SECRET;
  state.asked = [];
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

describe.each(ENDPOINTS)("$path", (endpoint) => {
  it("is public, held to the read limit, and answers a token signed over its own payload kind", async () => {
    const route = (await endpoint.load()).GET as unknown as Route;

    expect(route.auth).toBe("public");
    expect(route.rateLimit).toBe(LIMITS.read);
    expect((await call(endpoint)).status).toBe(200);
  });

  it("answers the payload itself, so the envelope is the whole body", async () => {
    expect(await (await call(endpoint)).json()).toEqual({ kind: endpoint.kind });
  });

  it("is switched off, not opened, while the deploy has no secret", async () => {
    state.secret = undefined;
    const answer = await call(endpoint);

    expect(answer.status).toBe(503);
    expect(await answer.json()).toEqual({ error: expect.stringContaining("STORE_SERVICE_TOKEN is not set") });
  });

  it("answers 404 with no token, and says which header to send and what to sign", async () => {
    const answer = await call(endpoint, { token: null });

    expect(answer.status).toBe(404);
    expect(await answer.json()).toEqual({ error: expect.stringContaining(TOKEN_HEADER) });
  });

  it("answers 404 for a token signed for another endpoint", async () => {
    const other: PayloadKind = endpoint.kind === "store-drops" ? "store-products" : "store-drops";

    expect((await call(endpoint, { signAs: other })).status).toBe(404);
  });

  it("answers 404 for a token that has run out", async () => {
    expect((await call(endpoint, { now: NOW + 10 * 60 * 1000 })).status).toBe(404);
  });

  it("answers 404 for a member's own session, because a session is not a key here", async () => {
    const route = (await endpoint.load()).GET as unknown as Route;
    const answer = await route.handler({
      input: { query: {} },
      session: SESSION,
      request: requestFor(endpoint.path, "", null),
      usage: null,
    });

    expect(answer.status).toBe(404);
  });
});

describe("the query a list endpoint takes", () => {
  const products = ENDPOINTS[1] as (typeof ENDPOINTS)[number];

  it("reads a limit and a brand, and refuses a limit outside the range", async () => {
    const route = (await products.load()).GET as unknown as Route;

    expect(route.schema.query?.safeParse({ limit: "25" }).success).toBe(true);
    expect(route.schema.query?.safeParse({ limit: "0" }).success).toBe(false);
    expect(route.schema.query?.safeParse({ limit: "500" }).success).toBe(false);
    expect(route.schema.query?.safeParse({ brandId: "not-a-brand" }).success).toBe(false);
  });

  it("hands the parsed query to the read, so a default is applied once", async () => {
    await call(products, { search: "?limit=5" });

    expect(state.asked).toEqual([{ limit: 5 }]);
  });

  it("refuses a token signed over a different query, so one cannot be replayed against another brand", async () => {
    const route = (await products.load()).GET as unknown as Route;
    const signed = signStoreToken(SECRET, "store-products", canonicalQuery({ brandId: "11111111-1111-4111-8111-111111111111" }), NOW / 1000);
    const answer = await route.handler({
      input: { query: { limit: 50 } },
      session: null,
      request: requestFor("/api/store/products", "?brandId=22222222-2222-4222-8222-222222222222", signed.token),
      usage: null,
    });

    expect(answer.status).toBe(404);
  });
});

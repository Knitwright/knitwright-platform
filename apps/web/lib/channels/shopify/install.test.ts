import { describe, expect, it, vi } from "vitest";
import { memoryChannels } from "../fixtures/memory-store";
import { openToken, tokenKey } from "../token-crypto";
import type { ShopifyAdmin } from "./admin";
import { ensureRegistered, finishInstall, shopOf } from "./install";
import { standInAdmin } from "./stand-in";

const KEY = tokenKey(undefined, "server");
const SHOP = "club.myshopify.com";

const deps = (admin: ShopifyAdmin = standInAdmin()) => {
  const memory = memoryChannels();
  const log = vi.fn();
  return { ...memory, log, deps: { store: memory.store, admin, key: KEY, siteUrl: "https://kw.test", log } };
};

describe("finishing an install (decision 0155)", () => {
  it("stores only the sealed token, then registers the fulfilment service and webhooks", async () => {
    const admin = standInAdmin();
    const registerWebhooks = vi.spyOn(admin, "registerWebhooks");
    const registerFulfilmentService = vi.spyOn(admin, "registerFulfilmentService");
    const { deps: d, connections } = deps(admin);
    const id = await finishInstall(d, { brandId: "b1", userId: "u1", shop: SHOP, code: "code" });
    const token = (await admin.exchangeCode(SHOP, "code")).accessToken;
    expect(JSON.stringify(connections)).not.toContain(token);
    expect(openToken(KEY, connections[0]!.sealed, SHOP)).toBe(token);
    expect(connections[0]!.locationId).toMatch(/Location/);
    expect(registerFulfilmentService).toHaveBeenCalledWith({ shop: SHOP, accessToken: token }, "https://kw.test/api/channels/shopify/fulfilment");
    expect(registerWebhooks).toHaveBeenCalledWith({ shop: SHOP, accessToken: token }, "https://kw.test/api/channels/shopify/webhooks");
    expect(id).toBe(connections[0]!.id);
  });

  it("keeps the connection when registration fails, logs it, and tries again later", async () => {
    const admin = { ...standInAdmin(), registerFulfilmentService: vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue({ locationId: "L1" }) };
    const { deps: d, connections, log, store } = deps(admin);
    await finishInstall(d, { brandId: "b1", userId: "u1", shop: SHOP, code: "c" });
    expect(connections[0]!.locationId).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
    expect(await ensureRegistered(d, (await store.secretById(connections[0]!.id))!)).toBe(true);
    expect(connections[0]!.locationId).toBe("L1");
    expect(await ensureRegistered(d, (await store.secretById(connections[0]!.id))!)).toBe(true);
    expect(admin.registerFulfilmentService).toHaveBeenCalledTimes(2);
  });

  it("cannot open a token sealed with another key", async () => {
    const { deps: d, store, connections } = deps();
    await finishInstall(d, { brandId: "b1", userId: "u1", shop: SHOP, code: "c" });
    const secret = (await store.secretById(connections[0]!.id))!;
    expect(shopOf(tokenKey("11".repeat(32), "x"), secret)).toBeNull();
    expect(await ensureRegistered({ ...d, key: tokenKey("11".repeat(32), "x") }, { ...secret, locationId: null })).toBe(false);
  });
});

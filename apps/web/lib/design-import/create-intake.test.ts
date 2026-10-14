import { describe, expect, it, vi } from "vitest";
import { MODEL_CATALOG } from "@/lib/providers/catalog";
import { createStubProvider } from "@/lib/providers/stub";
import { FAILED, createFromFile, refitImport, type CreateDeps } from "./create";
import { fakeDb } from "./fixtures/fake-db";
import { fakeStore } from "./fixtures/fake-store";

vi.mock("./intake", () => ({
  intakePicture: vi.fn(async () => {
    throw new Error("the intake broke");
  }),
}));

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const log = vi.fn();

describe("an intake that breaks", () => {
  it("is logged, gives the reservation back, and says so plainly", async () => {
    const db = fakeDb();
    const refund = vi.fn(async () => undefined);
    const deps: CreateDeps = {
      client: db.client,
      admin: db.client,
      who,
      vision: { provider: createStubProvider([]), entry: MODEL_CATALOG[5] },
      usage: { eventId: "e", refund, reserve: async () => null },
      log,
      timeoutMs: 1000,
      readFile: async () => ({ bytes: new Uint8Array([1]), contentType: "image/png" }),
      store: () => fakeStore().store,
      pipeline: () => {
        throw new Error("not reached");
      },
    };
    expect(await createFromFile(deps, { fileId: "55555555-5555-4555-8555-555555555555" })).toEqual({ kind: "rejection", reason: FAILED });
    expect(refund).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
    db.rows.push({ id: "66666666-6666-4666-8666-666666666666", brand_id: who.brandId });
    await expect(refitImport(deps, "66666666-6666-4666-8666-666666666666", {})).rejects.toThrow();
  });
});

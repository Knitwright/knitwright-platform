import { describe, expect, it } from "vitest";
import { createFakeAssetReader } from "@/lib/artwork-stack";
import { assetFactsFor } from "./asset-facts";
import { FIXTURE_STACK } from "./fixtures/stack";

describe("what is known about the pictures a stack uses", () => {
  it("reads the kind and pixel width of each uploaded picture once, and skips what the reader does not know", async () => {
    const asked: string[] = [];
    const inner = createFakeAssetReader([{ id: "asset-2", kind: "raster", widthPx: 640, heightPx: 480 }]);
    const reader = { getAsset: (id: string) => (asked.push(id), inner.getAsset(id)) };
    const facts = await assetFactsFor(FIXTURE_STACK, reader);
    expect(facts).toEqual({ "asset-2": { kind: "raster", widthPx: 640 } });
    expect(asked).toEqual(["asset-2"]);
  });

  it("leaves a picture out when the read fails, rather than guessing a size", async () => {
    const facts = await assetFactsFor(FIXTURE_STACK, { getAsset: async () => { throw new Error("down"); } });
    expect(facts).toEqual({});
  });
});

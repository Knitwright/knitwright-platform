import { describe, expect, it } from "vitest";
import { createSpec, type GarmentSpec } from "@/lib/garment";
import { IMAGE_UNAVAILABLE } from "@/lib/intent/image-input";
import { IMAGE_INPUT_TOKENS, MAX_OUTPUT_TOKENS, MAX_TEXT_INPUT_TOKENS, modelEntry } from "@/lib/providers/catalog";
import { createStubProvider } from "@/lib/providers/stub";
import { ModelCallError } from "@/lib/providers/text-model";
import type { RouteUsage } from "@/lib/server/core/metered";
import { TOO_LARGE } from "@/lib/storage/read";
import { IMAGE_FAILED, NOT_FOUND, NOT_READABLE_TYPE, TOO_LARGE_TO_READ, VISION_MAX_BYTES, imageCost, readImageRequest, type ImageRequestDeps } from "./image-request";

function spec(): GarmentSpec {
  const made = createSpec("crew-tee", "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
}

const PNG = { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" };
const polo = JSON.stringify({ kind: "changes", actions: [{ type: "change-type", typeId: "polo" }] });

function deps(overrides: Partial<ImageRequestDeps> = {}): ImageRequestDeps & { refunds: string[]; reads: [string, number][]; logs: unknown[] } {
  const refunds: string[] = [];
  const reads: [string, number][] = [];
  const logs: unknown[] = [];
  const usage: RouteUsage = { eventId: "event-1", refund: async () => void refunds.push("refund"), reserve: async () => null };
  return {
    refunds,
    reads,
    logs,
    spec: spec(),
    fileId: "file-1",
    readFile: async (id, max) => {
      reads.push([id, max]);
      return PNG;
    },
    provider: createStubProvider([polo]),
    usage,
    sign: (actions) => `signed:${actions.length}`,
    preview: () => null,
    log: (event) => void logs.push(event),
    timeoutMs: 1000,
    ...overrides,
  };
}

describe("reading an uploaded picture on the server", () => {
  it("reads the brand's file, sends it to the model, and returns a signed proposal to review", async () => {
    const given = deps();
    const result = await readImageRequest(given);
    expect(given.reads).toEqual([["file-1", VISION_MAX_BYTES]]);
    expect(result).toMatchObject({ kind: "proposal", token: "signed:1", flat: null });
    // A new type brings its own construction; each part of it is confirmed too.
    expect(result.kind === "proposal" && result.confirmations.map((entry) => entry.label)).toEqual([
      "The garment is a Polo shirt",
      "Collar: Polo collar",
      "Placket: Buttons",
      "Cuffs: No cuffs",
    ]);
    expect(given.refunds).toEqual([]);
  });

  it("gives an explained rejection for a picture that is not a garment, and keeps the cost of the call", async () => {
    const given = deps({ provider: createStubProvider([JSON.stringify({ kind: "rejection", reason: "This is a photo of a dog, not a garment." })]) });
    expect(await readImageRequest(given)).toEqual({ kind: "rejection", reason: "This is a photo of a dog, not a garment." });
    expect(given.refunds).toEqual([]);
  });

  it.each([
    [null, NOT_FOUND],
    [TOO_LARGE, TOO_LARGE_TO_READ],
    [{ bytes: new Uint8Array([1]), contentType: "image/gif" }, NOT_READABLE_TYPE],
  ] as const)("refunds and explains when the file cannot be sent (%#)", async (file, reason) => {
    const given = deps({ readFile: async () => file });
    expect(await readImageRequest(given)).toEqual({ kind: "rejection", reason });
    expect(given.refunds).toEqual(["refund"]);
  });

  it("refunds and explains when the model call fails", async () => {
    const given = deps({ provider: createStubProvider([new ModelCallError("down")]) });
    expect(await readImageRequest(given)).toEqual({ kind: "rejection", reason: IMAGE_FAILED });
    expect(given.refunds).toEqual(["refund"]);
    expect(given.logs).toHaveLength(1);
  });

  it("says reading is not available without a model, without reading the file", async () => {
    const given = deps({ provider: null });
    expect(await readImageRequest(given)).toEqual({ kind: "rejection", reason: IMAGE_UNAVAILABLE });
    expect(given.reads).toEqual([]);
  });

  it("prices a reading at the most it can use, the picture included", () => {
    const entry = modelEntry("claude-haiku-4-5");
    expect(imageCost(entry)).toEqual({ feature: "ai", microdollars: (MAX_TEXT_INPUT_TOKENS + IMAGE_INPUT_TOKENS) * 1 + MAX_OUTPUT_TOKENS * 5 });
  });
});

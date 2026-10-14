import { describe, expect, it } from "vitest";
import { MODEL_CATALOG } from "@/lib/providers/catalog";
import { createStubProvider } from "@/lib/providers/stub";
import type { ImageProvider } from "@/lib/providers/image-provider";
import { buildPipelineDeps, pickVisionModel } from "./deps";

const priced = (index: number) => ({ provider: createStubProvider([]), entry: MODEL_CATALOG[index] });

describe("pickVisionModel", () => {
  it("skips a model that is forced to call the assistant's tool and takes the first that can answer in text", () => {
    const haiku = priced(4);
    const sonnet = priced(5);
    expect(pickVisionModel({ primary: haiku, retry: sonnet })).toBe(sonnet);
    expect(pickVisionModel({ primary: sonnet, retry: haiku })).toBe(sonnet);
    expect(pickVisionModel({ primary: haiku, retry: null })).toBeNull();
    expect(pickVisionModel({ primary: null, retry: null })).toBeNull();
  });
});

describe("buildPipelineDeps", () => {
  it("fits to the stand-in pattern until the real pieces are connected, and reads no patterns yet", () => {
    const deps = buildPipelineDeps({ vision: priced(5), image: null, usage: null });
    expect(deps.standIn).toBe(true);
    expect(deps.pattern.reads).toBe(false);
    expect(deps.cleanup).toBeNull();
    expect(deps.provider?.model).toBe("stub-model");
  });
  it("has no provider without a model, and a clean-up with an image model", () => {
    const image: ImageProvider = { name: "i", generate: async () => ({ bytes: new Uint8Array(), contentType: "image/png" }) };
    expect(buildPipelineDeps({ vision: null, image, usage: null }).provider).toBeNull();
    expect(buildPipelineDeps({ vision: null, image, usage: null }).cleanup).not.toBeNull();
  });
});

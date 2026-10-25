import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/providers/image-provider";
import type { LifestyleRequest } from "../provider";
import { createFalLifestyleProvider } from "./fal";
import { createFashnProvider } from "./fashn";
import { createGoogleTryOnProvider, createRecontextProvider } from "./google";
import { MAX_BYTES, fromBase64, readBytes, send, sleep } from "./http";
import { createPhotoroomProvider } from "./photoroom";

/**
 * Contract tests: each adapter is run against a canned answer shaped like the provider's documentation says it is, with a
 * stand-in for `fetch`. Nothing here goes near a network. The answers are written from the public documentation, not
 * recorded from a live call (no key exists), so these tests prove the adapter's own behaviour, not the provider's.
 */

let picture: Uint8Array;
beforeAll(async () => {
  picture = new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#aa3322" } }).png().toBuffer());
});

const signal = new AbortController().signal;
const request = (over: Partial<LifestyleRequest> = {}): LifestyleRequest => ({
  scene: "pitch",
  prompt: "A fixed prompt.",
  seed: 42,
  reference: new Uint8Array([1, 2, 3]),
  garment: new Uint8Array([4, 5, 6]),
  modelImage: new Uint8Array([7, 8, 9]),
  ...over,
});

const answer = (body: BodyInit | null, init: ResponseInit = { status: 200 }) => new Response(body, init);
const json = (value: unknown, status = 200) => answer(JSON.stringify(value), { status });
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

describe("http helpers", () => {
  it("turns a network failure into a provider error that can be retried", async () => {
    const error = await send(async () => Promise.reject(new Error("down")), "The thing", "https://x", {}).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ refused: false, message: "The thing could not be reached." });
  });

  it.each([[401, true], [403, true], [400, true], [408, false], [429, false], [500, false], [503, false]])("marks status %i as refused=%s and keeps the provider's words out of the message", async (status, refused) => {
    const error = await send(async () => answer("secret detail from the provider", { status }), "The thing", "https://x", {}).catch((e) => e);
    expect(error.refused).toBe(refused);
    expect(error.message).not.toContain("secret");
    expect(error.cause).toBe("secret detail from the provider");
  });

  it("decodes base64 with or without a data prefix and refuses empty or oversized pictures", () => {
    expect(Array.from(fromBase64(b64(new Uint8Array([1, 2])), "X"))).toEqual([1, 2]);
    expect(Array.from(fromBase64(`data:image/png;base64,${b64(new Uint8Array([3]))}`, "X"))).toEqual([3]);
    expect(() => fromBase64("", "X")).toThrow(ProviderError);
    expect(() => fromBase64("A".repeat(Math.ceil((MAX_BYTES * 4) / 3) + 8), "X")).toThrow(/too large/);
  });

  it("reads response bytes and refuses an empty body or a declared size over the limit", async () => {
    expect(Array.from(await readBytes(answer(new Uint8Array([9, 9])), "X"))).toEqual([9, 9]);
    await expect(readBytes(answer(new Uint8Array(0)), "X")).rejects.toThrow(/no usable picture/);
    await expect(readBytes(answer("x", { headers: { "content-length": String(MAX_BYTES + 1) } }), "X")).rejects.toThrow(/too large/);
  });

  it("sleeps, and stops at once when the time is up", async () => {
    await sleep(1, signal);
    await expect(sleep(1, AbortSignal.abort())).rejects.toThrow(ProviderError);
    const controller = new AbortController();
    const pending = sleep(10_000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow(/time ran out/);
  });
});

describe("photoroom", () => {
  it("posts the render with the key, the prompt and the seed and returns the picture's bytes", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => answer(picture.buffer.slice(0) as ArrayBuffer));
    const out = await createPhotoroomProvider({ apiKey: "k", fetch: fetcher }).generate(request(), signal);
    expect(Buffer.compare(out, picture)).toBe(0);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://image-api.photoroom.com/v2/edit");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("k");
    const form = init?.body as FormData;
    expect(form.get("background.prompt")).toBe("A fixed prompt.");
    expect(form.get("background.seed")).toBe("42");
    expect(form.get("referenceBox")).toBe("originalImage");
    expect(form.get("imageFile")).toBeInstanceOf(Blob);
  });

  it("makes the three scenes and not the model", () => {
    expect(createPhotoroomProvider({ apiKey: "k" }).scenes).toEqual(["pitch", "changing_room", "street"]);
  });

  it("refuses on a bad key", async () => {
    const error = await createPhotoroomProvider({ apiKey: "bad", fetch: async () => answer("no", { status: 401 }) }).generate(request(), signal).catch((e) => e);
    expect(error.refused).toBe(true);
  });
});

describe("google", () => {
  const options = (fetcher: (url: string, init: RequestInit) => Promise<Response>) => ({ accessToken: "t", project: "proj", location: "europe-west4", fetch: fetcher });

  it("recontext sends the render as the product picture and decodes the first prediction", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => json({ predictions: [{ bytesBase64Encoded: b64(picture), mimeType: "image/png" }] }));
    const out = await createRecontextProvider(options(fetcher)).generate(request(), signal);
    expect(Buffer.compare(out, picture)).toBe(0);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://europe-west4-aiplatform.googleapis.com/v1/projects/proj/locations/europe-west4/publishers/google/models/imagen-product-recontext-preview-06-30:predict");
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer t");
    const body = JSON.parse(init?.body as string);
    expect(body.instances[0].prompt).toBe("A fixed prompt.");
    expect(body.instances[0].productImages[0].image.bytesBase64Encoded).toBe(b64(new Uint8Array([1, 2, 3])));
    expect(body.parameters).toEqual({ sampleCount: 1 });
  });

  it("try-on sends the person and the garment", async () => {
    const fetcher = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => json({ predictions: [{ bytesBase64Encoded: b64(picture) }] }));
    const provider = createGoogleTryOnProvider(options(fetcher));
    expect(provider.scenes).toEqual(["on_model"]);
    expect(provider.needsModelImage).toBe(true);
    await provider.generate(request({ scene: "on_model" }), signal);
    const body = JSON.parse((fetcher.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.instances[0].personImage.image.bytesBase64Encoded).toBe(b64(new Uint8Array([7, 8, 9])));
    expect(body.instances[0].productImages[0].image.bytesBase64Encoded).toBe(b64(new Uint8Array([1, 2, 3])));
  });

  it("try-on refuses without a person's picture, before any request", async () => {
    const fetcher = vi.fn();
    const call = () => createGoogleTryOnProvider(options(fetcher)).generate(request({ modelImage: null }), signal);
    await expect(call()).rejects.toMatchObject({ refused: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ predictions: [] }], [{ predictions: [{}] }], ["nonsense"]])("says no picture came back for %j", async (answerBody) => {
    const error = await createRecontextProvider(options(async () => json(answerBody))).generate(request(), signal).catch((e) => e);
    expect(error).toMatchObject({ message: "The image service returned no picture.", refused: false });
  });
});

describe("fashn", () => {
  const script = (steps: Response[]) => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return steps.shift() ?? answer("late", { status: 500 });
    };
    return { calls, fetcher };
  };
  const make = (fetcher: (url: string, init: RequestInit) => Promise<Response>, maxPolls = 5) => createFashnProvider({ apiKey: "k", fetch: fetcher, pollMs: 1, maxPolls });

  it("starts a run, polls until it completes and decodes the picture", async () => {
    const { calls, fetcher } = script([json({ id: "run-1" }), json({ status: "processing" }), json({ status: "completed", output: [`data:image/png;base64,${b64(picture)}`] })]);
    const out = await make(fetcher).generate(request({ scene: "on_model" }), signal);
    expect(Buffer.compare(out, picture)).toBe(0);
    expect(calls.map((c) => c.url)).toEqual(["https://api.fashn.ai/v1/run", "https://api.fashn.ai/v1/status/run-1", "https://api.fashn.ai/v1/status/run-1"]);
    const body = JSON.parse(calls[0]?.init.body as string);
    expect(body.model_name).toBe("tryon-v1.6");
    expect(body.inputs.seed).toBe(42);
    expect(body.inputs.model_image).toBe(`data:image/png;base64,${b64(new Uint8Array([7, 8, 9]))}`);
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe("Bearer k");
  });

  it("refuses without a person's picture", async () => {
    await expect(make(script([]).fetcher).generate(request({ modelImage: null }), signal)).rejects.toMatchObject({ refused: true });
  });

  it.each([
    ["a run that did not start", [json({})], /did not start/],
    ["a failed run", [json({ id: "r" }), json({ status: "failed", error: { name: "x" } })], /could not make/],
    ["a completed run with no output", [json({ id: "r" }), json({ status: "completed", output: [] })], /no picture/],
    ["an unreadable status", [json({ id: "r" }), json({ nope: true })], /could not be read/],
    ["a run that never completes", [json({ id: "r" }), json({ status: "processing" }), json({ status: "processing" })], /took too long/],
  ])("fails clearly on %s", async (_name, steps, message) => {
    const error = await make(script(steps).fetcher, 2).generate(request(), signal).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.message).toMatch(message);
  });
});

describe("fal", () => {
  it("passes the prompt and the render to the existing client and returns its bytes", async () => {
    const generate = vi.fn(async () => ({ bytes: picture, contentType: "image/png" }));
    const provider = createFalLifestyleProvider({ name: "fal:test", generate });
    expect(provider.scenes).toHaveLength(4);
    expect(provider.costMicrodollars).toBe(80_000);
    const out = await provider.generate(request(), signal);
    expect(Buffer.compare(out, picture)).toBe(0);
    expect(generate).toHaveBeenCalledWith({ prompt: "A fixed prompt.", reference: new Uint8Array([1, 2, 3]) }, signal);
    expect(provider.name).toBe("fal:test");
  });
});

import { describe, expect, it } from "vitest";
import { readCredits, readLatest, startClip, startSet, unlockSet } from "./api";
import { PROJECT, SET, setOf, unlocked } from "./fixtures";
import { SAME_VERSION_MESSAGE, UNREACHABLE_MESSAGE } from "./copy";

type Call = { url: string; init?: RequestInit };

const answer = (body: unknown, status = 200) => async (): Promise<Response> => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const recording = (respond: () => Promise<Response>) => {
  const calls: Call[] = [];
  return { calls, fetcher: async (url: string, init?: RequestInit) => (calls.push({ url, ...(init ? { init } : {}) }), respond()) };
};
const ok = (data: unknown) => ({ success: true, data });
const failure = (message: string) => ({ success: false, error: { message } });

describe("readLatest", () => {
  it("returns the newest set, or none", async () => {
    const set = setOf();
    const a = recording(answer(ok({ set })));
    expect(await readLatest(PROJECT, a.fetcher)).toEqual({ ok: true, set });
    expect(a.calls[0]?.url).toBe(`/api/projects/${PROJECT}/media`);
    expect(await readLatest(PROJECT, recording(answer(ok({ set: null }))).fetcher)).toEqual({ ok: true, set: null });
  });

  it("says so when the server cannot be reached or answers in an unknown shape", async () => {
    const down = async (): Promise<Response> => {
      throw new Error("offline");
    };
    expect(await readLatest(PROJECT, down)).toEqual({ ok: false, message: UNREACHABLE_MESSAGE });
    expect((await readLatest(PROJECT, recording(answer({ nonsense: true })).fetcher)).ok).toBe(false);
  });

  it("passes on the server's own sentence", async () => {
    expect(await readLatest(PROJECT, recording(answer(failure("Sign in again."), 401)).fetcher)).toEqual({ ok: false, message: "Sign in again." });
  });

  it("refuses a set that carries a path to a clean file", async () => {
    const leaky = { ...setOf(), items: [{ ...setOf().items[0], cleanPath: "_private/x.png" }] };
    expect((await readLatest(PROJECT, recording(answer(ok({ set: leaky }))).fetcher)).ok).toBe(false);
  });
});

describe("startSet", () => {
  it("posts an empty body and reports whether a new set was made", async () => {
    const set = setOf({ status: "queued", items: [] });
    const a = recording(answer(ok({ created: true, set })));
    expect(await startSet(PROJECT, a.fetcher)).toEqual({ ok: true, created: true, set });
    expect(a.calls[0]?.init?.method).toBe("POST");
    expect(a.calls[0]?.init?.body).toBe("{}");
    expect(await startSet(PROJECT, recording(answer(ok({ created: false, set }))).fetcher)).toMatchObject({ ok: true, created: false });
  });

  it("gives the sentence when the design has no drawing", async () => {
    expect(await startSet(PROJECT, recording(answer(failure("There is no drawing of this garment to make media from yet."), 400)).fetcher)).toEqual({
      ok: false,
      message: "There is no drawing of this garment to make media from yet.",
    });
  });
});

describe("unlockSet", () => {
  it("posts to the unlock address and then reads the set again", async () => {
    const set = unlocked(setOf());
    const sequence = [ok({ unlocked: true, changed: true }), ok({ set })];
    const calls: string[] = [];
    const fetcher = async (url: string) => (calls.push(url), new Response(JSON.stringify(sequence.shift()), { status: 200 }));
    expect(await unlockSet(PROJECT, SET, fetcher)).toEqual({ ok: true, set });
    expect(calls).toEqual([`/api/projects/${PROJECT}/media/${SET}/unlock`, `/api/projects/${PROJECT}/media/${SET}`]);
  });

  it("shows the gate's refusal, such as a short balance, and reads nothing more", async () => {
    const a = recording(answer(failure("Marketing media costs 5 credits. Your balance is 2."), 409));
    expect(await unlockSet(PROJECT, SET, a.fetcher)).toEqual({ ok: false, message: "Marketing media costs 5 credits. Your balance is 2." });
    expect(a.calls).toHaveLength(1);
  });
});

describe("startClip", () => {
  it("posts the view of the still", async () => {
    const a = recording(answer(ok({ state: "started" })));
    expect(await startClip(PROJECT, SET, "scene", a.fetcher)).toEqual({ ok: true, state: "started" });
    expect(a.calls[0]?.url).toBe(`/api/projects/${PROJECT}/media/${SET}/clip`);
    expect(JSON.parse(String(a.calls[0]?.init?.body))).toEqual({ view: "scene" });
  });
});

describe("readCredits", () => {
  const summary = { enforced: false, balance: 40, prices: { marketing_media: 5, techpack_pdf: 3, pattern_file: 3 }, isPlaceholder: true };

  it("reads the price of marketing media and the balance", async () => {
    expect(await readCredits(recording(answer(ok(summary))).fetcher)).toEqual({ enforced: false, balance: 40, price: 5, isPlaceholder: true });
  });

  it("is null when credits cannot be read, so the screen still works", async () => {
    expect(await readCredits(recording(answer(failure("no"), 500)).fetcher)).toBeNull();
  });
});

it("has a sentence for a set that already exists", () => {
  expect(SAME_VERSION_MESSAGE).toMatch(/new version/);
});

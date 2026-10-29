import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { createMemoryStore } from "./fixtures/memory-store";
import { madeUpMark, otherPicture } from "./fixtures/pictures";
import { imageHash } from "./image-hash";
import {
  assertHumanReviewed, refuseIfBlocked, screenBeforeOrder, screenGeneration, screenText, screenUpload,
  type ModerationDeps,
} from "./hooks";
import { DEFAULT_SETTINGS } from "./settings";
import type { Mark } from "./types";
import { createStubVisionCheck } from "./vision";

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";
const ASSET = "44444444-4444-4444-8444-444444444444";
const SHA = "a".repeat(64);
const who = { brandId: BRAND, userId: USER };

const NIKE: Mark = { id: "n", holder: "Nike, Inc.", markText: "Nike", imageHash: null };

const depsOf = (marks: readonly Mark[] = []) => {
  const memory = createMemoryStore(marks);
  const deps: ModerationDeps = { store: memory.store, vision: createStubVisionCheck(), settings: DEFAULT_SETTINGS };
  return { ...memory, deps };
};

describe("refusing a blocked verdict", () => {
  it("says the first blocking reason, against the named field", () => {
    const verdict = { result: "blocked" as const, reasons: [{ code: "profanity" as const, severity: "block" as const, message: "No.", ruleId: "R-GAP-000" }] };
    try {
      refuseIfBlocked(verdict, "title");
      expect.unreachable("it should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error as AppError).toMatchObject({ code: "invalid_input", message: "No.", fields: { title: ["No."] } });
    }
  });

  it("lets a clear or flagged verdict through", () => {
    expect(refuseIfBlocked({ result: "flagged", reasons: [] })).toBeUndefined();
  });
});

describe("screening an upload", () => {
  const upload = async (over: Partial<Parameters<typeof screenUpload>[1]> = {}, marks: readonly Mark[] = []) => {
    const context = depsOf(marks);
    const after = await screenUpload(context.deps, { ...who, label: "Club crest", image: await otherPicture(), sourceSha256: SHA, ...over });
    return { ...context, after };
  };

  it("clears an ordinary upload and keeps the result against the stored asset", async () => {
    const { after, checks } = await upload();
    expect(checks).toEqual([]);
    await after(ASSET);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ brandId: BRAND, userId: USER, targetKind: "asset", targetId: ASSET, hook: "upload", subjectSha256: SHA });
    expect(checks[0]!.verdict.result).toBe("clear");
  });

  it("refuses a picture of a registered mark before anything is stored, and keeps the result with no asset", async () => {
    const registered = await imageHash(await madeUpMark());
    const context = depsOf([{ id: "m", holder: "Made Up Ltd", markText: null, imageHash: registered }]);
    const screen = screenUpload(context.deps, { ...who, label: "crest", image: await madeUpMark(150), sourceSha256: SHA });
    await expect(screen).rejects.toThrow(/matches a registered mark of Made Up Ltd/);
    expect(context.checks).toHaveLength(1);
    expect(context.checks[0]).toMatchObject({ targetId: null, verdict: { result: "blocked" } });
  });

  it("flags an upload whose file name names another brand, and still stores it", async () => {
    const { after, checks } = await upload({ label: "nike-swoosh.png" }, [NIKE]);
    await after(ASSET);
    expect(checks[0]!.verdict.result).toBe("flagged");
    expect(checks[0]!.verdict.reasons.map((r) => r.code)).toContain("brand_term");
  });

  it("logs, and does not throw, when the result cannot be kept: the file is already stored", async () => {
    const log = vi.fn();
    const context = depsOf();
    const after = await screenUpload({ ...context.deps, log }, { ...who, label: "crest", image: await otherPicture(), sourceSha256: SHA });
    context.failRecords();
    await expect(after(ASSET)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(ASSET), expect.any(Error));
  });

  it("works for a person who is not named (an ops upload)", async () => {
    const { after, checks } = await upload({ userId: null });
    await after(ASSET);
    expect(checks[0]!.userId).toBeNull();
  });
});

describe("screening a text", () => {
  it("keeps the context and the words with the result", async () => {
    const { deps, checks } = depsOf([NIKE]);
    const verdict = await screenText(deps, { ...who, text: "Nike dupe", context: "title" });
    expect(verdict.result).toBe("blocked");
    expect(checks[0]).toMatchObject({ targetKind: "text", targetId: null, hook: "text", label: "title: Nike dupe" });
  });

  it("can be kept against a design version", async () => {
    const { deps, checks } = depsOf();
    await screenText(deps, { ...who, text: "Smith", context: "name", targetKind: "version", targetId: VERSION });
    expect(checks[0]).toMatchObject({ targetKind: "version", targetId: VERSION });
  });
});

describe("screening a generation", () => {
  it("screens the prompt and the picture together and keeps the result against the generation", async () => {
    const { deps, checks } = depsOf([NIKE]);
    const verdict = await screenGeneration(deps, { ...who, generationId: VERSION, image: await otherPicture(), prompt: "a nike style vest" });
    expect(verdict.result).toBe("flagged");
    expect(checks[0]).toMatchObject({ targetKind: "generation", targetId: VERSION, hook: "generation" });
  });
});

describe("screening before an order", () => {
  const order = (over: Partial<Parameters<typeof screenBeforeOrder>[1]> = {}) => ({
    ...who, versionId: VERSION, label: "Club jersey", assetIds: [] as readonly string[], texts: [], classB: false, ...over,
  });

  it("flags a picture that was never screened", async () => {
    const { deps } = depsOf();
    const verdict = await screenBeforeOrder(deps, order({ assetIds: [ASSET] }));
    expect(verdict.result).toBe("flagged");
    expect(verdict.reasons[0]).toMatchObject({ code: "not_screened", term: ASSET });
  });

  it("clears a picture whose last check was clear, and counts a repeated id once", async () => {
    const { deps, checks } = depsOf();
    const after = await screenUpload(deps, { ...who, label: "crest", image: await otherPicture(), sourceSha256: SHA });
    await after(ASSET);
    const verdict = await screenBeforeOrder(deps, order({ assetIds: [ASSET, ASSET] }));
    expect(verdict).toEqual({ result: "clear", reasons: [] });
    expect(checks).toHaveLength(2);
  });

  it("holds a flagged picture until a person has looked, and clears it once they allow it", async () => {
    const { deps, checks, decide } = depsOf([NIKE]);
    const after = await screenUpload(deps, { ...who, label: "nike.png", image: await otherPicture(), sourceSha256: SHA });
    await after(ASSET);
    expect((await screenBeforeOrder(deps, order({ assetIds: [ASSET] }))).reasons[0]).toMatchObject({ code: "awaiting_review" });
    decide(checks[0]!.id, "allowed");
    expect((await screenBeforeOrder(deps, order({ assetIds: [ASSET] }))).result).toBe("clear");
  });

  it("blocks an order whose picture a person blocked", async () => {
    const { deps, checks, decide } = depsOf([NIKE]);
    const after = await screenUpload(deps, { ...who, label: "nike.png", image: await otherPicture(), sourceSha256: SHA });
    await after(ASSET);
    decide(checks[0]!.id, "blocked");
    const verdict = await screenBeforeOrder(deps, order({ assetIds: [ASSET] }));
    expect(verdict.result).toBe("blocked");
    expect(verdict.reasons[0]).toMatchObject({ code: "blocked_by_review" });
  });

  it("screens every text again", async () => {
    const { deps } = depsOf([NIKE]);
    const verdict = await screenBeforeOrder(deps, order({ texts: [{ text: "Nike shirt", context: "title" }, { text: "Smith", context: "name" }] }));
    expect(verdict.result).toBe("blocked");
  });

  it("holds a Class B run until a person has allowed the design version", async () => {
    const { deps, checks, decide } = depsOf();
    const verdict = await screenBeforeOrder(deps, order({ classB: true }));
    expect(verdict.reasons[0]).toMatchObject({ code: "human_review_required", severity: "flag" });
    decide(checks[0]!.id, "allowed");
    expect((await screenBeforeOrder(deps, order({ classB: true }))).result).toBe("clear");
  });

  it("asks nothing extra of a Class A order", async () => {
    const { deps } = depsOf();
    expect((await screenBeforeOrder(deps, order())).result).toBe("clear");
  });
});

describe("the guard a Class B run calls", () => {
  it("refuses until a person has allowed the design version, then lets the run start", async () => {
    const { deps, store, checks, decide } = depsOf();
    await screenText(deps, { ...who, text: "Nike", context: "label", targetKind: "version", targetId: VERSION });
    await expect(assertHumanReviewed(store, VERSION)).rejects.toThrow(/needs our review/);
    decide(checks[0]!.id, "allowed");
    await expect(assertHumanReviewed(store, VERSION)).resolves.toBeUndefined();
  });

  it("refuses again when something was flagged after the decision", async () => {
    const { deps, store, checks, decide } = depsOf([NIKE]);
    await screenText(deps, { ...who, text: "Nike", context: "label", targetKind: "version", targetId: VERSION });
    decide(checks[0]!.id, "allowed");
    await screenText(deps, { ...who, text: "Nike again", context: "label", targetKind: "version", targetId: VERSION });
    await expect(assertHumanReviewed(store, VERSION)).rejects.toThrow(/needs our review/);
  });
});

import { describe, expect, it } from "vitest";
import { acceptAsset, GENERATED_LABEL, type DrawnAsset, type LaunchAsset, type SceneAsset } from "@/lib/launch";
import { createStubProvider } from "@/lib/providers/stub";
import { GENERATED_IS_NEVER_ARTWORK, fillLayout, fillSlot, type SlotFill } from "./assets";
import { NOT_TEXT, writeForMe, type WriteRequest } from "./copy/write";
import type { BrandVoice } from "./copy/voice";
import { buildLayouts } from "./templates/plans";
import { slot } from "./templates/types";

/**
 * THE TEST SPEC DECISION 13 ASKS FOR (plan v5 L4: "A test proves generated output cannot reach a
 * panel layer or a print file where your code could allow it").
 *
 * The garment is always locked. A marketing layout is built **around** pixel-locked mockups: the
 * garment in a picture is never restyled, recoloured or redrawn by this code or by a model, and
 * what a model writes is words in a field.
 *
 * Each door is watched here with a cast past the compiler, exactly as `lib/launch/assets.test.ts`
 * does, because the compiler's own refusal cannot be written as a test that runs.
 */

const file = { fileId: "file-1", contentType: "image/png" };
const drawn: DrawnAsset = { role: "print_file", provenance: "deterministic", file };
const golden: DrawnAsset = { role: "panel_layer", provenance: "golden_sample", file };
const generated: SceneAsset = { role: "scene", provenance: "generated", file, label: GENERATED_LABEL, showsPerson: false };

const mockupSlot = slot({ id: "mockup", kind: "mockup", label: "Mockup", rect: { x: 0.06, y: 0.16, width: 0.88, height: 0.48 } });
const headline = slot({ id: "headline", kind: "text", label: "Headline", rect: { x: 0.06, y: 0.68, width: 0.88, height: 0.1 }, style: "headline", limit: 40 });

const VOICE: BrandVoice = { brandId: "brand-1", name: "Harrow Town FC", tags: ["bold"], about: null, styles: null };

describe("door one: the type system", () => {
  it("has no way to write a generated picture down as the contents of a slot", () => {
    // `SlotFill`'s picture carries a DrawnAsset. A SceneAsset is not one, and this cast is the only
    // way to express it at all -- which is the point: the compiler refuses it in real code.
    const impossible = { kind: "picture", asset: generated as unknown as DrawnAsset } as SlotFill;
    expect(fillSlot(mockupSlot, impossible)).toEqual({ ok: false, reason: GENERATED_IS_NEVER_ARTWORK, ruleId: "R-GAP-000" });
  });

  it("takes a picture the platform drew, and a photograph of a golden sample", () => {
    expect(fillSlot(mockupSlot, { kind: "picture", asset: drawn }).ok).toBe(true);
    expect(fillSlot(mockupSlot, { kind: "picture", asset: golden }).ok).toBe(true);
  });
});

describe("door two: the seam", () => {
  it("refuses a generated picture read back out of a row, which the compiler never saw", () => {
    const fromDatabase = JSON.parse(JSON.stringify({ kind: "picture", asset: generated })) as SlotFill;
    expect(fillSlot(mockupSlot, fromDatabase).ok).toBe(false);
  });

  it("refuses it in every slot of every layout of 07, not only in a mockup slot", () => {
    const fill = { kind: "picture", asset: generated as unknown as DrawnAsset } as SlotFill;
    for (const layout of buildLayouts()) {
      for (const one of layout.slots) {
        const verdict = fillSlot(one, fill);
        expect(verdict.ok, `${layout.key}/${one.id}`).toBe(false);
      }
    }
  });

  it("names the refusal beside the slot rather than dropping the fill silently", () => {
    const offered = new Map<string, SlotFill>([
      ["mockup", { kind: "picture", asset: generated as unknown as DrawnAsset } as SlotFill],
      ["headline", { kind: "words", text: "New kit. Out Friday." }],
    ]);
    const filled = fillLayout([mockupSlot, headline], offered);

    expect([...filled.fills.keys()]).toEqual(["headline"]);
    expect(filled.refusals).toEqual([GENERATED_IS_NEVER_ARTWORK]);
  });

  it("refuses what the launch shell refuses: a generated picture offered as a marketing board's output", () => {
    // L1's own door, asked here so this workstream cannot drift from it.
    expect(acceptAsset("marketing", generated as LaunchAsset).accepted).toBe(false);
    expect(acceptAsset("marketing", drawn).accepted).toBe(true);
  });
});

describe("door three: a model writes words and nothing else", () => {
  it("refuses to fill a mockup slot even when one is handed to it past the compiler", async () => {
    const provider = createStubProvider([JSON.stringify({ options: ["anything"] })]);
    const request = { slot: mockupSlot, highlight: "", campaign: null, voice: VOICE } as WriteRequest;

    const result = await writeForMe(provider, request);

    expect(result.ok ? "" : result.reason).toBe(NOT_TEXT);
    expect(provider.requests).toEqual([]);
  });

  it("gives back words, which are not an asset and so cannot be offered as one", async () => {
    const provider = createStubProvider([JSON.stringify({ options: ["New kit. Out Friday."] })]);
    const result = await writeForMe(provider, { slot: headline, highlight: "", campaign: null, voice: VOICE });

    expect(result.ok && result.options.every((option) => typeof option === "string")).toBe(true);
    // Nothing in a reply carries a provenance, a role or a file, which is what an asset is made of.
    expect(result.ok && Object.keys(result).sort()).toEqual(["model", "ok", "options", "usage"]);
  });

  it("will not put a model's words in a slot that is not a text field", () => {
    const words: SlotFill = { kind: "words", text: "New kit" };
    expect(fillSlot(mockupSlot, words).ok).toBe(false);
    expect(fillSlot(headline, words).ok).toBe(true);
  });

  it("holds words to the field's own limit, so a layout is never redrawn to fit them", () => {
    const verdict = fillSlot(headline, { kind: "words", text: "x".repeat(41) });
    expect(verdict.ok ? "" : verdict.reason).toBe("Headline takes up to 40 characters.");
  });
});

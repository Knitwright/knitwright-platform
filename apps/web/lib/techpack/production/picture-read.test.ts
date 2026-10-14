import { describe, expect, it } from "vitest";
import { ACCURACY_LIMITS, FORBIDDEN_WORDS } from "@/lib/design-import/report";
import { ALL_KINDS_STACK, IMPORT_REPORT, PICTURE_ACCEPTED, PICTURE_NOT_ACCEPTED, PICTURE_STACK } from "../fixtures/stacks";
import { leaves } from "../walk";
import { pictureBlock, READ_FROM_PICTURE } from "./picture-read";

describe("a design read from a picture", () => {
  it("has no block when no layer came from a picture and no reading is on record", () => {
    expect(pictureBlock(ALL_KINDS_STACK, null)).toBeNull();
    expect(pictureBlock(null, null)).toBeNull();
  });

  it("carries the report, the limits and the user's acceptance record", () => {
    const block = pictureBlock(PICTURE_STACK, PICTURE_ACCEPTED)!;
    expect(block.accepted).toBe(true);
    expect(block.acceptedBy).toEqual({ status: "set", value: "Mia Chen on 12 Oct 2026", provenance: "user-edited" });
    expect(block.notAccepted).toEqual([]);
    expect(block.limits).toEqual(ACCURACY_LIMITS);
    expect(block.closeReading).toBe(READ_FROM_PICTURE);
    expect(block.summary).toBe(IMPORT_REPORT.summary);
    expect(block.pictureNote).toBe("Mockup, flattened approximately");
    expect(block.confidence).toBe("medium (62%)");
    expect(block.items).toEqual([{ label: "Crest", confidence: "medium (50%)", note: "Redrawn from a picture, replace with your own file" }]);
    expect(block.emptyViews).toEqual(IMPORT_REPORT.emptyViews.map((view) => view.sentence));
    expect(block.guessed).toEqual(["The size of the sponsor line"]);
    expect(block.notes).toEqual(IMPORT_REPORT.notes);
    expect(block.fittedTo).toBe("Fitted to the flat outline of the pattern");
  });

  it("is not accepted until a named person accepted it, and names the layers the acceptance does not cover", () => {
    const none = pictureBlock(PICTURE_STACK, PICTURE_NOT_ACCEPTED)!;
    expect(none).toMatchObject({ accepted: false, acceptedBy: { status: "to-be-confirmed" }, notAccepted: ["Body", "Club crest", "Sponsor line"] });
    const partial = pictureBlock(PICTURE_STACK, { ...PICTURE_ACCEPTED, acceptedLayerIds: ["ground-body", "crest"] })!;
    expect(partial).toMatchObject({ accepted: false, notAccepted: ["Sponsor line"] });
  });

  it("has a block, without a report, for layers marked as read from a picture when no reading is on record", () => {
    const block = pictureBlock(PICTURE_STACK, null)!;
    expect(block).toMatchObject({ accepted: false, summary: null, confidence: null, items: [], fittedTo: null, pictureNote: null });
    expect(block.limits).toEqual(ACCURACY_LIMITS);
  });

  it("reads a reading on record even when the design has no stack", () => {
    expect(pictureBlock(null, PICTURE_ACCEPTED)).toMatchObject({ accepted: true, notAccepted: [] });
  });

  it("never claims the reading is exact", () => {
    const block = pictureBlock(PICTURE_STACK, PICTURE_ACCEPTED)!;
    for (const { leaf } of leaves(block)) expect(String(leaf)).not.toMatch(FORBIDDEN_WORDS);
    expect(READ_FROM_PICTURE).toMatch(/close reading/);
  });
});

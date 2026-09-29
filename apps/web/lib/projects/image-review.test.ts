import { describe, expect, it } from "vitest";
import { canApply, imageReviewReducer, initialReview, parseImageAnswer, type ReviewEvent, type ReviewState } from "./image-review";

const proposal = {
  kind: "proposal" as const,
  explanations: ["Garment type changed from Crew neck tee to Polo shirt."],
  notes: [],
  confirmations: [
    { id: "type", label: "The garment is a Polo shirt" },
    { id: "option:collar", label: "Collar: Polo collar" },
  ],
  token: "t",
  flat: null,
};

const play = (...events: ReviewEvent[]): ReviewState => events.reduce(imageReviewReducer, initialReview);

describe("the review of a picture", () => {
  it("goes from upload to reading to a review, with nothing ticked", () => {
    const state = play({ type: "chosen", previewUrl: "blob:1" }, { type: "uploaded" }, { type: "read", answer: proposal });
    expect(state.stage).toBe("review");
    expect(state.previewUrl).toBe("blob:1");
    expect(state.ticked).toEqual([]);
    expect(canApply(state)).toBe(false);
  });

  it("applies only once the person has confirmed the type and every construction choice", () => {
    const one = play({ type: "chosen", previewUrl: "p" }, { type: "uploaded" }, { type: "read", answer: proposal }, { type: "tick", id: "type", on: true });
    expect(canApply(one)).toBe(false);
    const both = imageReviewReducer(one, { type: "tick", id: "option:collar", on: true });
    expect(canApply(both)).toBe(true);
    const untick = imageReviewReducer(both, { type: "tick", id: "type", on: false });
    expect(canApply(untick)).toBe(false);
    expect(imageReviewReducer(both, { type: "tick", id: "not-listed", on: true }).ticked).toEqual(both.ticked);
  });

  it("shows a rejection as a reason, and failures plainly", () => {
    const refused = play({ type: "chosen", previewUrl: "p" }, { type: "uploaded" }, { type: "read", answer: { kind: "rejection", reason: "That is a dog." } });
    expect(refused).toMatchObject({ stage: "failed", message: "That is a dog." });
    expect(canApply(refused)).toBe(false);
    expect(play({ type: "chosen", previewUrl: "p" }, { type: "failed", message: "Upload failed." })).toMatchObject({ stage: "failed", message: "Upload failed." });
  });

  it("applies, finishes, and can be discarded at any point", () => {
    const ready = play(
      { type: "chosen", previewUrl: "p" },
      { type: "uploaded" },
      { type: "read", answer: proposal },
      { type: "tick", id: "type", on: true },
      { type: "tick", id: "option:collar", on: true },
    );
    const applying = imageReviewReducer(ready, { type: "applying" });
    expect(applying.stage).toBe("applying");
    expect(canApply(applying)).toBe(false);
    expect(imageReviewReducer(applying, { type: "applied" }).stage).toBe("done");
    expect(imageReviewReducer(applying, { type: "discard" })).toEqual(initialReview);
    expect(imageReviewReducer(initialReview, { type: "applying" })).toBe(initialReview);
  });
});

describe("reading the server's answer", () => {
  it("reads a proposal or a rejection, and anything else as a failure", () => {
    expect(parseImageAnswer({ success: true, data: proposal })).toEqual(proposal);
    expect(parseImageAnswer({ success: true, data: { kind: "rejection", reason: "No." } })).toEqual({ kind: "rejection", reason: "No." });
    expect(parseImageAnswer({ success: false, error: { message: "Used up." } })).toEqual({ kind: "rejection", reason: "Used up." });
    expect(parseImageAnswer("junk")).toMatchObject({ kind: "rejection", reason: expect.stringMatching(/could not be read/) });
  });
});

import { describe, expect, it } from "vitest";
import { changesBody, goldenSamplePomBody, goldenSampleReadingBody, runBody, sampleBody, selectSizesBody, signOffBody, startGoldenSampleBody, goldenSamplePhotoBody } from "./schemas";

const UUID = "11111111-1111-4111-8111-111111111111";
const KEY = "abcdefgh";

describe("what the make pages may send", () => {
  it("takes a sample of one to three sizes and no more", () => {
    expect(sampleBody.safeParse({ projectId: UUID, productId: UUID, releaseId: UUID, fabricKey: "F-STK-TEE", sizes: ["S", "M"], requestKey: KEY }).success).toBe(true);
    expect(sampleBody.safeParse({ projectId: UUID, productId: UUID, releaseId: UUID, fabricKey: "F-STK-TEE", sizes: ["S", "M", "L", "XL"], requestKey: KEY }).success).toBe(false);
    expect(sampleBody.safeParse({ projectId: UUID, productId: UUID, releaseId: UUID, fabricKey: "F-STK-TEE", sizes: [], requestKey: KEY }).success).toBe(false);
  });

  it("takes a run as the pieces typed per size", () => {
    const parsed = runBody.safeParse({ projectId: UUID, productId: UUID, releaseId: UUID, fabricKey: "F-STK-TEE", quantities: { M: "60" }, requestKey: KEY });
    expect(parsed.success && parsed.data.quantities).toEqual({ M: "60" });
    expect(runBody.safeParse({ projectId: UUID, productId: UUID, releaseId: UUID, fabricKey: "", quantities: {}, requestKey: KEY }).success).toBe(false);
  });

  it("takes the order modal's lines, each a whole number of pieces", () => {
    expect(selectSizesBody.safeParse({ lines: [{ productId: UUID, size: "M", pieces: 60 }], requestKey: KEY }).success).toBe(true);
    expect(selectSizesBody.safeParse({ lines: [{ productId: UUID, size: "M", pieces: 0 }], requestKey: KEY }).success).toBe(false);
    expect(selectSizesBody.safeParse({ lines: [], requestKey: KEY }).success).toBe(false);
  });

  it("takes a measurement in whole millimetres, with its tolerance empty where none is on file", () => {
    const parsed = goldenSamplePomBody.safeParse({ projectId: UUID, goldenSampleId: UUID, sizeLabel: "M", letter: "A", code: "chest", measuredMm: 532 });
    expect(parsed.success && parsed.data).toMatchObject({ targetMm: null, tolMinusMm: null, tolPlusMm: null, ruleId: "R-GAP-000", description: "" });
    expect(goldenSamplePomBody.safeParse({ projectId: UUID, goldenSampleId: UUID, sizeLabel: "M", letter: "A", code: "chest", measuredMm: 532.5 }).success).toBe(false);
    expect(goldenSamplePomBody.safeParse({ projectId: UUID, goldenSampleId: UUID, sizeLabel: "M", letter: "1", code: "chest", measuredMm: 1 }).success).toBe(false);
    expect(goldenSamplePomBody.safeParse({ projectId: UUID, goldenSampleId: UUID, sizeLabel: "M", letter: "A", code: "chest", measuredMm: 1, ruleId: "nope" }).success).toBe(false);
  });

  it("takes a colour reading, and leaves the white point and the observer empty unless they were stated", () => {
    const parsed = goldenSampleReadingBody.safeParse({ projectId: UUID, goldenSampleId: UUID, colourName: "Navy", deltaE: 1.24 });
    expect(parsed.success && parsed.data).toMatchObject({ whitePoint: null, observer: null, targetLab: null, measuredLab: null });
    expect(goldenSampleReadingBody.safeParse({ projectId: UUID, goldenSampleId: UUID, colourName: "Navy", deltaE: 1.2, targetLab: [1, 2] }).success).toBe(false);
    expect(goldenSampleReadingBody.safeParse({ projectId: UUID, goldenSampleId: UUID, colourName: "Navy", deltaE: -1 }).success).toBe(false);
    expect(goldenSampleReadingBody.safeParse({ projectId: UUID, goldenSampleId: UUID, colourName: "Navy", deltaE: 1, targetHex: "navy" }).success).toBe(false);
  });

  it("takes both marks, each 1 to 5, and the reason changes are asked for", () => {
    expect(signOffBody.safeParse({ projectId: UUID, goldenSampleId: UUID, fitRating: 4, colourRating: 5 }).success).toBe(true);
    expect(signOffBody.safeParse({ projectId: UUID, goldenSampleId: UUID, fitRating: 6, colourRating: 5 }).success).toBe(false);
    expect(changesBody.safeParse({ projectId: UUID, goldenSampleId: UUID, notes: "The hem is short." }).success).toBe(true);
    expect(changesBody.safeParse({ projectId: UUID, goldenSampleId: UUID, notes: "   " }).success).toBe(false);
  });

  it("takes a photo of the sample from one of the brand's own pictures, at a known angle", () => {
    expect(goldenSamplePhotoBody.safeParse({ projectId: UUID, goldenSampleId: UUID, fileId: UUID, angle: "front" }).success).toBe(true);
    expect(goldenSamplePhotoBody.safeParse({ projectId: UUID, goldenSampleId: UUID, fileId: UUID, angle: "sideways" }).success).toBe(false);
    expect(startGoldenSampleBody.safeParse({ projectId: UUID, productId: UUID, runId: UUID }).success).toBe(true);
  });
});

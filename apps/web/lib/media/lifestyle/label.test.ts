import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AI_LABEL_KEYWORD, isLabelledAi, labelAsAi, readTextChunks } from "./label";

const png = async () => new Uint8Array(await sharp({ create: { width: 8, height: 6, channels: 3, background: "#336699" } }).png().toBuffer());

describe("labelAsAi", () => {
  it("writes the label and a description into the picture's own metadata", async () => {
    const out = labelAsAi(await png(), { provider: "stub", scene: "pitch" });
    expect(isLabelledAi(out)).toBe(true);
    const chunks = readTextChunks(out);
    expect(chunks[AI_LABEL_KEYWORD]).toBe("true");
    expect(chunks.Description).toContain("AI generated");
    expect(chunks.Description).toContain("Scene: pitch");
  });

  it("leaves the pixels alone and the file readable", async () => {
    const before = await png();
    const out = labelAsAi(before, { provider: "stub", scene: "street" });
    const a = await sharp(before).raw().toBuffer();
    const b = await sharp(out).raw().toBuffer();
    expect(Buffer.compare(a, b)).toBe(0);
    expect((await sharp(out).metadata()).width).toBe(8);
  });

  it("is deterministic and carries no date", async () => {
    const one = labelAsAi(await png(), { provider: "stub", scene: "pitch" });
    const two = labelAsAi(await png(), { provider: "stub", scene: "pitch" });
    expect(Buffer.compare(one, two)).toBe(0);
  });

  it("keeps the description to plain Latin-1 characters", async () => {
    const out = labelAsAi(await png(), { provider: "fotó ✓", scene: "pitch" });
    expect(readTextChunks(out).Description).toContain("fot? ?");
  });

  it("reports a picture with no label as unlabelled", async () => {
    expect(isLabelledAi(await png())).toBe(false);
    expect(readTextChunks(await png())).toEqual({});
  });
});

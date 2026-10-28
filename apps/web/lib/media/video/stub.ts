import { createHash } from "node:crypto";
import { AI_GENERATED_LABEL } from "./limits";
import type { VideoProvider } from "./provider";
import { element, text, uint } from "./webm";

const STUB_PROVIDER = "stub-video";

/**
 * A placeholder WebM for tests and for a studio with no video key: a valid EBML header and an info block that says what the
 * file is and carries a hash of the still it was "made" from. It has no picture frames, so it is NOT a playable clip.
 * The same still gives the same bytes.
 */
export function stubWebm(still: Uint8Array, seconds: number): Uint8Array {
  const hash = createHash("sha256").update(still).digest("hex");
  const header = element(0x1a45dfa3, [...element(0x4282, text("webm")), ...element(0x4287, uint(4)), ...element(0x4285, uint(2))]);
  const info = element(0x1549a966, [
    ...element(0x2ad7b1, uint(1_000_000)),
    ...element(0x7ba9, text(`${AI_GENERATED_LABEL}: Knitwright stub clip, not a playable video (${hash.slice(0, 16)})`)),
    ...element(0x4d80, text("Knitwright stub")),
    ...element(0x5741, text("Knitwright stub")),
    ...element(0x4489, uint(seconds * 1000)),
  ]);
  return new Uint8Array([...header, ...element(0x18538067, info)]);
}

export const stubVideoProvider = (): VideoProvider => ({
  name: STUB_PROVIDER,
  costMicrodollars: 0,
  async generate({ still, seconds }) {
    return { ok: true, video: stubWebm(still, seconds), type: "video/webm" };
  },
});

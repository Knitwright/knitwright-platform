import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalDisplayList } from "@/lib/artwork-stack/generator";
import { KIT_STYLE_GENERATORS } from "@/lib/artwork-stack/legacy/kit-styles";
import { findGenerator } from "./registry";
import { contextOf } from "./fixtures/contexts";

const hash = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

const CASES = [
  { name: "defaults", patch: {} },
  { name: "sized", patch: { params: { bandWidthMm: 65, dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true, clearSpaceMm: 10 } } },
  { name: "one colour, back", patch: { view: "back" as const, colours: ["#d4af37"] } },
];

/** Output of the seven styles and dots, captured from `legacy/kit-styles.ts` before they moved under the registry. */
const GOLDEN: Record<string, string> = {
  "kit-hoops/defaults": "37475c544c10e72c",
  "kit-hoops/sized": "75a8e54a486b5a6a",
  "kit-hoops/one colour, back": "f88a28761b3ffb4c",
  "kit-stripes/defaults": "eea238ae5f479150",
  "kit-stripes/sized": "f318db565090de7d",
  "kit-stripes/one colour, back": "9f56000600037d7a",
  "kit-pinstripes/defaults": "caeb61c7654de5d2",
  "kit-pinstripes/sized": "c9cfe0d9672fe228",
  "kit-pinstripes/one colour, back": "4d8225d9256a2289",
  "kit-sash/defaults": "3b00e17d000172a2",
  "kit-sash/sized": "8a5ec643fafcd253",
  "kit-sash/one colour, back": "6c1dcc168e002e23",
  "kit-side-panels/defaults": "bb2a5ac9ef2aa9f0",
  "kit-side-panels/sized": "509137317c3677c0",
  "kit-side-panels/one colour, back": "72895358697d2e85",
  "kit-chest-band/defaults": "2cde16e488cc7e62",
  "kit-chest-band/sized": "0a6b48a0691c7bde",
  "kit-chest-band/one colour, back": "eaf8090e076c4628",
  "kit-fade/defaults": "9f4faf6526c139c6",
  "kit-fade/sized": "9f4faf6526c139c6",
  "kit-fade/one colour, back": "456e3323f476cc39",
  "kit-dots/defaults": "b954e475350f46d9",
  "kit-dots/sized": "b954e475350f46d9",
  "kit-dots/one colour, back": "2845857cb0ed19d9",
};

describe("adapters keep today's drawing", () => {
  it("are all in the registry under the same ids", () => {
    for (const legacy of KIT_STYLE_GENERATORS) expect(findGenerator(legacy.id)).toBe(legacy);
  });

  it.each(KIT_STYLE_GENERATORS.flatMap((generator) => CASES.map((entry) => ({ generator, entry }))))(
    "$generator.id $entry.name",
    ({ generator, entry }) => {
      const found = findGenerator(generator.id);
      const list = found?.render(contextOf(entry.patch));
      expect(hash(canonicalDisplayList(list ?? { shapes: [] }))).toBe(GOLDEN[`${generator.id}/${entry.name}`]);
    },
  );
});

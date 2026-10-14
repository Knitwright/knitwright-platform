import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalDisplayList } from "@/lib/artwork-stack/generator";
import { contextOf } from "./fixtures/contexts";
import { NEW_GENERATORS } from "./registry";

/** Pinned: the display list of each new generator at its defaults, seed 7. A different hash on another machine or Node version would show up here. */
const PINNED: Record<string, string> = {
  "camo": "4efa4bfcc23e7419",
  "geometric": "8b772a995492aa88",
  "gradient": "611ba284a505a88f",
  "halftone": "3c2f0896c1e1b931",
  "checks": "990916be785c5117",
  "brush": "1fe0645f1ffcd071",
  "stripe-rhythm": "96ff96f4c55e517a",
};

describe("new generators are the same on any machine", () => {
  it.each(NEW_GENERATORS.map((generator) => [generator.id, generator] as const))("%s", (id, generator) => {
    const text = canonicalDisplayList(generator.render(contextOf()));
    expect(createHash("sha256").update(text).digest("hex").slice(0, 16)).toBe(PINNED[id]);
  });
});

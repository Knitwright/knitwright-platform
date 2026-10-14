import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JERSEY_EU48, TEE_EU48 } from "@/lib/production/fixtures";
import { readDxf } from "./read";

const REFERENCE = join(__dirname, "../../../../../docs/owner/reference/fashioninsta-2026-10-14");
const load = (name: string) => readFileSync(join(REFERENCE, name), "utf8");

describe("reading the benchmark DXFs", () => {
  it.each([
    ["pattern_1598.dxf", JERSEY_EU48],
    ["pattern_1597.dxf", TEE_EU48],
  ])("%s gives exactly the W0 fixture pieces", (file, fixture) => {
    const { pieces, warnings, info } = readDxf(load(file));
    expect(pieces).toEqual(fixture.piecesBySize["48"]);
    expect(warnings).toEqual([]);
    expect(info.sampleSize).toBe("48");
  });
});

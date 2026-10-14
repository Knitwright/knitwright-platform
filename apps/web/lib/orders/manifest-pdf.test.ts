import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { buildManifest } from "./manifest";
import { manifestPdf } from "./manifest-pdf";

const RUN = ["S", "M", "L", "XL", "2XL", "3XL"];

describe("manifestPdf", () => {
  it("reads back with the totals and the players", async () => {
    const facts = await readPdf(await manifestPdf(buildManifest("Sample team", ROSTER_22.rows, RUN), "Polka jersey"));
    expect(facts.startsAsPdf).toBe(true);
    expect(facts.text).toContain("Team order: Sample team");
    expect(facts.text).toContain("OKAFOR");
    expect(facts.text).toContain("22");
  }, 30_000);

  it("gives the same bytes twice", async () => {
    const m = buildManifest("Sample team", ROSTER_22.rows, RUN);
    const [a, b] = [await manifestPdf(m, "J"), await manifestPdf(m, "J")];
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  }, 30_000);

  it("shows a character the font lacks as a question mark instead of garbling the line", async () => {
    const rows = [{ name: "A中B", number: "1", sizeLabel: "M", cut: "mens", quantity: 1 } as const];
    const facts = await readPdf(await manifestPdf(buildManifest("X", rows, RUN), "J"));
    expect(facts.text).toContain("A?B");
  }, 30_000);
});

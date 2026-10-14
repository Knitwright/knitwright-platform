import { describe, expect, it, vi } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import type { GarmentSpec } from "@/lib/garment";
import type { OpenProject } from "@/lib/projects/service";
import { buildTechPackPage } from "@/lib/projects/tech-pack-data";
import { NO_CHART_SET } from "@/lib/sizing/fixtures/no-charts";
import { flatsForTechPack } from "@/lib/techpack/flats";
import { cardFacts } from "./card";

vi.mock("@/lib/techpack/flats", async (original) => {
  const actual = await original<typeof import("@/lib/techpack/flats")>();
  return { ...actual, flatsForTechPack: vi.fn(actual.flatsForTechPack) };
});

const NOW = new Date("2026-10-14T12:00:00.000Z");

const project = (spec: GarmentSpec): OpenProject => ({
  id: "3f0c2c9e-6f0a-4d0e-9a51-0d6c1c1f7a11",
  name: "Club shirt",
  styleNumber: "",
  season: "",
  garmentType: spec.typeId,
  garmentLabel: "Crew neck tee",
  currentVersion: 2,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-13T10:00:00Z",
  versionSavedAt: "2026-10-13T10:00:00Z",
  spec,
  dropped: [],
});

describe("cardFacts", () => {
  it("counts the empty fields exactly as the factory file page does", () => {
    const open = project(start("crew-tee"));
    const page = buildTechPackPage({
      project: open,
      history: { versions: [], hasMore: false },
      brandName: "Audit Rovers",
      images: new Map(),
      now: NOW,
      charts: NO_CHART_SET,
    });

    const facts = cardFacts(open, "Audit Rovers", NO_CHART_SET, NOW);

    expect(facts.toConfirm).toBe(page.report.total);
    expect(facts.toConfirm).toBeGreaterThan(0);
  });

  it("draws the front of the design as a picture", () => {
    const facts = cardFacts(project(start("crew-tee")), "Audit Rovers", NO_CHART_SET, NOW);

    expect(facts.thumbnail?.src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it.each(["crew-tee", "polo", "pullover-hoodie", "shorts", "track-jacket"])(
    "gives a %s the same count and the same drawing of its first colourway as the factory file page",
    (typeId) => {
      const open = project(start(typeId, "men"));
      const page = buildTechPackPage({
        project: open,
        history: { versions: [], hasMore: false },
        brandName: "Audit Rovers",
        images: new Map(),
        now: NOW,
        charts: NO_CHART_SET,
      });

      const facts = cardFacts(open, "Audit Rovers", NO_CHART_SET, NOW);

      expect(facts.toConfirm).toBe(page.report.total);
      expect(facts.thumbnail?.src ?? null).toBe(page.colourwayFlats[0]?.src ?? null);
    },
  );

  it("draws no flats of the front and back, which the card does not show", () => {
    vi.mocked(flatsForTechPack).mockClear();

    cardFacts(project(start("crew-tee")), "Audit Rovers", NO_CHART_SET, NOW);

    expect(flatsForTechPack).not.toHaveBeenCalled();
  });
});

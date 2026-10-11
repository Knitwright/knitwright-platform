import { describe, expect, it } from "vitest";
import { CHARTS, fullDesign } from "@/lib/techpack/fixtures/designs";
import { buildSharePage, type SharePageInput } from "./public-view";

const input = (patch: Partial<SharePageInput> = {}): SharePageInput => ({
  projectName: "Home kit 2027",
  brandName: "Northside Hockey Club",
  version: 3,
  savedAt: "2026-10-04T09:30:00Z",
  expiresAt: "2026-11-03T09:30:00Z",
  spec: fullDesign("crew-tee"),
  charts: CHARTS,
  images: new Map(),
  ...patch,
});

const decoded = (src: string | null): string => decodeURIComponent((src ?? "").replace(/^data:image\/svg\+xml[^,]*,/, ""));

describe("buildSharePage", () => {
  it("names the design, the brand, the version and its date", () => {
    expect(buildSharePage(input())).toMatchObject({
      designName: "Home kit 2027",
      brandName: "Northside Hockey Club",
      version: 3,
      savedOn: "4 Oct 2026",
      expiresOn: "3 Nov 2026",
    });
  });

  it("draws the front and the back with the tech pack's renderer, with no measurement callouts", () => {
    const page = buildSharePage(input());

    expect(page.flats.map((flat) => [flat.view, flat.label])).toEqual([
      ["front", "Front"],
      ["back", "Back"],
    ]);
    for (const flat of page.flats) {
      expect(flat.src).toMatch(/^data:image\/svg\+xml/);
      expect(flat.alt.length).toBeGreaterThan(0);
      const svg = decoded(flat.src);
      expect(svg).toContain("<svg");
      expect(svg).not.toMatch(/\d cm/);
      expect(svg).not.toContain('id="measurements"');
    }
  });

  it("lists each colourway with the colour of each panel and a drawing in that colourway", () => {
    const page = buildSharePage(input());

    expect(page.colourways.map((colourway) => colourway.name)).toEqual(["Home", "Away"]);
    const home = page.colourways[0];
    expect(home.colours).toContainEqual({ panel: "Body front", colour: "Navy 19-4052", swatch: "#1b2a49" });
    expect(home.colours).toContainEqual({ panel: "Body back", colour: null, swatch: "#aa0000" });
    expect(home.picture.src).toMatch(/^data:image\/svg\+xml/);
    expect(page.colourways[1].colours).toContainEqual({ panel: "Body front", colour: "White", swatch: null });
  });

  it("passes on only a plain hex screen colour, since it goes into a style", () => {
    const spec = fullDesign("crew-tee");
    const odd = {
      ...spec,
      colourways: [
        { ...spec.colourways[0], colours: [{ panelId: "body-front", colour: "Navy", swatch: "url(https://example.com/x)", provenance: "user-edited" as const }] },
      ],
    };

    expect(buildSharePage(input({ spec: odd as never })).colourways[0].colours).toContainEqual({ panel: "Body front", colour: "Navy", swatch: null });
  });

  it("lists each fabric by name and what it is made of, with the panels it is used for", () => {
    const [fabric] = buildSharePage(input()).fabrics;

    expect(fabric.name).toBe("Interlock");
    expect(fabric.composition).toBe("Cotton and elastane");
    expect(fabric.panels.length).toBeGreaterThan(0);
  });

  it("leaves out everything a committee does not need: measurements, construction, labels, components and notes", () => {
    const text = JSON.stringify(buildSharePage(input()));

    for (const hidden of ["Text for care", "Text for origin", "Name of ", "Some details", "Dense", "gsm", "grams per square metre", "Enzyme washed", "1.2 m", "Interlock knit"]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("says so when the garment type has no drawing", () => {
    const page = buildSharePage(input({ spec: { ...fullDesign("crew-tee"), typeId: "no-such-type" } as never }));

    expect(page.flats.every((flat) => flat.src === null && flat.notice !== null)).toBe(true);
  });
});

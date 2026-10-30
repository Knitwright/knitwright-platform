import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fullDesign } from "@/lib/techpack/fixtures/designs";
import { LETTERING_STYLES } from "@/lib/garment";
import { composeColour, roleChoices, splitColour } from "./colour";
import { everyStyleListed, FONT_LIST_LABEL, fontForStyle, KIT_FONTS } from "./fonts";
import { markPreview, PREVIEW_NOTE, SPEC_SAMPLE_NAME, SPEC_SAMPLE_NUMBER } from "./preview";
import { RosterPreview } from "./RosterPreview";
import { namesNumbersView, setColour, setZoneHeight, toggleZone } from "./state";
import { ZONE_RULES, zoneGaps, zonesOf } from "./zones";

/**
 * Names & numbers (spec F-S4). Three rules decide most of what is here: no font is called licensed
 * unless the repository really holds its licence, no zone is invented, and no height is guessed.
 */

const spec = () => fullDesign("crew-tee");
const view = () => namesNumbersView(spec(), spec().colourways[0]!.id);

describe("the font list", () => {
  it("calls exactly one font licensed, the one whose file ships in the repository", () => {
    const licensed = KIT_FONTS.filter((font) => font.licence === "licensed");
    expect(licensed).toHaveLength(1);
    expect(licensed[0]?.name).toContain("Geist");
    expect(licensed[0]?.licenceNote).toContain("SIL Open Font License 1.1");
  });

  it("says of every other font that no file for it is licensed yet, and never implies one is", () => {
    for (const font of KIT_FONTS.filter((entry) => entry.licence !== "licensed")) {
      expect(font.licenceNote, font.id).toContain("No font file for this style is licensed yet");
      expect(font.licenceNote, font.id).not.toMatch(/\bis licensed\b(?! yet)/);
    }
  });

  it("labels the whole list as a placeholder, not a licensed kit-font kit", () => {
    expect(FONT_LIST_LABEL).toContain("Placeholder list, not a licensed kit-font kit");
  });

  it("offers a font for every lettering style a design can store, so none is unreachable", () => {
    expect(everyStyleListed()).toBe(true);
    for (const style of LETTERING_STYLES) expect(fontForStyle(style)?.style, style).toBe(style);
    expect(fontForStyle("")).toBeNull();
    expect(fontForStyle("gothic")).toBeNull();
  });
});

describe("the zones", () => {
  it("takes the zones from the garment and never invents one", () => {
    const zones = view().zones;
    expect(zones.length).toBeGreaterThan(0);
    // A tee has no leg, so no leg zone is offered.
    expect(zones.some((zone) => zone.place === "leg-number")).toBe(false);
    expect(zonesOf(null)).toEqual([]);
  });

  it("carries the R-PER entry of each zone the rulebook names, and never the wrong one", () => {
    expect(ZONE_RULES["back-name"]).toBe("R-PER-001");
    expect(ZONE_RULES["back-number"]).toBe("R-PER-002");
    expect(ZONE_RULES["front-number"]).toBe("R-PER-003");
    // The rulebook names nothing for a number on the leg, so it is a gap, not R-PER-002 again.
    expect(ZONE_RULES["leg-number"]).toBe("R-GAP-000");
  });

  it("says plainly which zones the rulebook has no words for yet", () => {
    const zones = [...view().zones, { place: "leg-number" as const, label: "Leg", on: true, heightCm: "", ruleId: "R-GAP-000", ruleMissing: true, anchorSentence: "" }];
    expect(zoneGaps(zones)).toEqual(["leg-number"]);
    expect(zoneGaps(view().zones)).toEqual([]);
  });

  it("ticks and unticks one zone without touching another, and leaves a height empty until typed", () => {
    const form = view().form!;
    const place = form.places[0]!.place;
    expect(form.places.every((entry) => entry.heightCm === "")).toBe(true);
    const off = toggleZone(form, place, false);
    expect(off.places.find((entry) => entry.place === place)?.on).toBe(false);
    expect(off.places.filter((entry) => entry.place !== place)).toEqual(form.places.filter((entry) => entry.place !== place));
    expect(setZoneHeight(form, place, "6").places.find((entry) => entry.place === place)?.heightCm).toBe("6");
  });
});

describe("the colour and its outline", () => {
  it("writes both into the one instruction the design stores, and reads them back", () => {
    expect(composeColour({ colour: "Navy 19-4024 TCX", outline: "White" })).toBe("Navy 19-4024 TCX · outline White");
    expect(splitColour("Navy 19-4024 TCX · outline White")).toEqual({ colour: "Navy 19-4024 TCX", outline: "White" });
  });

  it("keeps a colour with no outline exactly as it was typed", () => {
    expect(composeColour({ colour: "Navy", outline: "  " })).toBe("Navy");
    expect(splitColour("Navy")).toEqual({ colour: "Navy", outline: "" });
    expect(splitColour("")).toEqual({ colour: "", outline: "" });
  });

  it("takes an outline with no colour of its own", () => {
    expect(composeColour({ colour: "", outline: "White" })).toBe("outline White");
    expect(splitColour("outline White")).toEqual({ colour: "", outline: "White" });
  });

  it("offers the colour roles the design already names, once each", () => {
    expect(roleChoices([{ label: "Front", colourText: "Navy" }, { label: "Back", colourText: "navy" }, { label: "Sleeve", colourText: "" }])).toEqual([
      { id: "Navy", label: "Front: Navy" },
    ]);
  });

  it("puts a chosen colour and outline back on the form as one instruction", () => {
    const form = setColour(view().form!, "Navy", "White");
    expect(form.colour).toBe("Navy · outline White");
  });
});

describe("the preview roster entry", () => {
  it("reads SMITH 7 on a design that has no names and numbers yet, as the spec shows", () => {
    expect(view().preview.roster).toBe(`${SPEC_SAMPLE_NAME} ${SPEC_SAMPLE_NUMBER}`);
    expect(view().preview.roster).toBe("SMITH 7");
  });

  it("uses the outline as a colour where one was given, and as words where it is a name", () => {
    const form = view().form!;
    expect(markPreview({ ...form, colour: "Navy · outline #ffffff" }, []).outlineFill).toBe("#ffffff");
    expect(markPreview({ ...form, colour: "Navy · outline #ffffff" }, []).outlineWords).toBeNull();
    expect(markPreview({ ...form, colour: "Navy · outline White" }, []).outlineWords).toBe("White");
    expect(markPreview({ ...form, colour: "Navy · outline White" }, []).outlineFill).toBeNull();
  });

  it("never says it is drawn to the finished size", () => {
    expect(PREVIEW_NOTE).toContain("Not drawn to the finished size");
  });

  it("draws the sample name, the sample number and that one line", () => {
    const html = renderToStaticMarkup(createElement(RosterPreview, { view: view().preview }));
    expect(html).toContain("SMITH");
    expect(html).toContain(">7<");
    expect(html).toContain(PREVIEW_NOTE);
    expect(html).toContain('data-roster="SMITH 7"');
  });

  it("says when no zone is chosen, rather than drawing lettering nothing carries", () => {
    const html = renderToStaticMarkup(createElement(RosterPreview, { view: markPreview(view().form!, []) }));
    expect(html).toContain("No zone is chosen yet");
  });

  it("names the zones the lettering is on", () => {
    const html = renderToStaticMarkup(createElement(RosterPreview, { view: view().preview }));
    expect(html).toContain("On: ");
  });

  it("never uses the words the wording rules forbid", () => {
    const html = renderToStaticMarkup(createElement(RosterPreview, { view: view().preview }));
    expect(html).not.toMatch(/\b(checked|verified|approved|confirmed|final|production-ready|passed|validated|certified)\b/i);
  });
});

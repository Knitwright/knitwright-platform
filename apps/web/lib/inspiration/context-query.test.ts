import { describe, expect, it } from "vitest";
import { previewDiff } from "@/lib/design-diff/preview";
import { defaultFactoryProfile } from "@/lib/validation";
import { buildContextQuery, colourNamesOf, designContext, panelIdsOf, steerTag, styleTagsOf, tagText, type ContextInput } from "./context-query";
import { jersey, withPattern } from "./fixtures/designs";
import { MAX_TAGS } from "./vocabulary";

/**
 * The context query (spec F-S1, "The context query"): sport and base article, the names of the dominant colours, the
 * style tags of the chosen options, and the brand's mood words, with pin and remove to steer it.
 */

const input: ContextInput = {
  sports: ["rugby", "training"],
  articleName: "Short sleeve jersey",
  colourNames: ["Navy", "gold"],
  styleTags: ["raglan sleeve", "mock neck"],
  moodWords: ["bold", "nocturnal"],
};

describe("buildContextQuery", () => {
  it("reads the sport, the article, the colours, the style and the mood, in that order", () => {
    const query = buildContextQuery(input);
    expect(query.tags.map((tag) => [tag.kind, tag.text])).toEqual([
      ["sport", "rugby"],
      ["sport", "training"],
      ["article", "short sleeve jersey"],
      ["colour", "navy"],
      ["colour", "gold"],
      ["style", "raglan sleeve"],
      ["style", "mock neck"],
      ["mood", "bold"],
      ["mood", "nocturnal"],
    ]);
    expect(query.text).toBe("rugby training short sleeve jersey navy gold raglan sleeve mock neck bold nocturnal");
  });

  it("lowers, trims and squeezes a tag, and drops one that is left empty", () => {
    expect(tagText("  Mock   NECK ")).toBe("mock neck");
    expect(buildContextQuery({ ...input, moodWords: ["  ", "Bold"] }).tags.filter((tag) => tag.kind === "mood")).toEqual([{ kind: "mood", text: "bold" }]);
  });

  it("keeps each word once, whichever source gave it first", () => {
    const query = buildContextQuery({ ...input, moodWords: ["navy", "bold"] });
    expect(query.tags.filter((tag) => tag.text === "navy")).toEqual([{ kind: "colour", text: "navy" }]);
  });

  it("leaves out a tag the person removed, and remembers that they removed it", () => {
    const query = buildContextQuery(input, { navy: "removed", "mock neck": "removed" });
    expect(query.tags.map((tag) => tag.text)).not.toContain("navy");
    expect(query.tags.map((tag) => tag.text)).not.toContain("mock neck");
    expect(query.removed).toEqual(["mock neck", "navy"]);
  });

  it("adds a pinned tag the design does not imply, at the end, marked as the person's own", () => {
    const query = buildContextQuery(input, { "90s away kit": "pinned" });
    expect(query.tags.at(-1)).toEqual({ kind: "pinned", text: "90s away kit" });
  });

  it("leaves a pinned tag the design already implies where the design put it", () => {
    const query = buildContextQuery(input, { navy: "pinned" });
    expect(query.tags.filter((tag) => tag.text === "navy")).toEqual([{ kind: "colour", text: "navy" }]);
  });

  it("carries at most twelve tags, however many the design and the brand have", () => {
    const many = buildContextQuery({ ...input, moodWords: Array.from({ length: 20 }, (_value, at) => `mood ${at}`) });
    expect(many.tags).toHaveLength(MAX_TAGS);
  });
});

describe("steerTag", () => {
  it("pins, removes and clears one tag, by its tidied word", () => {
    const pinned = steerTag({}, " Navy ", "pinned");
    expect(pinned).toEqual({ navy: "pinned" });
    expect(steerTag(pinned, "navy", "removed")).toEqual({ navy: "removed" });
    expect(steerTag(pinned, "navy", null)).toEqual({});
  });

  it("ignores a word that is nothing but space", () => {
    expect(steerTag({ navy: "pinned" }, "   ", "removed")).toEqual({ navy: "pinned" });
  });
});

describe("what the design object itself says", () => {
  it("takes the colour names a person typed, and none of the hex codes", () => {
    const coloured = previewDiff(jersey(), { kind: "set-colour", panels: ["body-front"], colour: "Navy", swatch: "#1b2a49" }, defaultFactoryProfile());
    expect(coloured.ok).toBe(true);
    if (!coloured.ok) return;
    expect(colourNamesOf(coloured.after)).toContain("Navy");
    expect(colourNamesOf(coloured.after).join(" ")).not.toContain("#");
    expect(colourNamesOf(withPattern())).toContain("navy");
  });

  it("names the pattern style and the chosen options as style tags", () => {
    const tags = styleTagsOf(withPattern());
    expect(tags[0]).toBe("hoops");
    expect(tags.length).toBeGreaterThan(1);
  });

  it("falls back to the garment type's own label when no base article is mapped yet", () => {
    const context = designContext(jersey(), { sports: [], articleName: null, moodWords: [] });
    expect(context.articleName).toBe("Team jersey");
  });

  it("uses the catalogue's name and sport tags when there is one", () => {
    const context = designContext(jersey(), { sports: ["rugby"], articleName: "Short sleeve jersey", moodWords: ["bold"] });
    expect(context).toMatchObject({ sports: ["rugby"], articleName: "Short sleeve jersey", moodWords: ["bold"] });
  });

  it("lists the panels the base really carries, so a suggestion cannot invent one", () => {
    expect(panelIdsOf(jersey())).toContain("body-front");
    expect(panelIdsOf(jersey())).not.toContain("welded-zip");
  });
});

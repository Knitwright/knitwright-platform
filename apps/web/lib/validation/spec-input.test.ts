import { describe, expect, it } from "vitest";
import { jersey, LOGO_AND_TEXT, MARKS, kitPatternOf } from "@/lib/artwork-stack/fixtures/designs";
import { ALL_KINDS_STACK, withStack as withStoredStack } from "@/lib/techpack/fixtures/stacks";
import { UNWIRED_CATALOGUE, UNWIRED_MODERATION, UNWIRED_PORTS, type ArticleCatalogue, type ModerationReader, type ParameterDef } from "./ports";
import { articleOf, guardrailInputOf, moderationTargets, specInput, standardRegistry, usedColours } from "./spec-input";

/**
 * What the X4 check modules read about a stored design, and the two ports they read it through
 * (plan v5 Lessons 9: the catalogue is X1, moderation is X8).
 */

const DEFS: readonly ParameterDef[] = [{ key: "body_length_offset", type: "range", min: -30, max: 40, step: 10, ruleId: "R-PAT-003" }];

const catalogue = (overrides: Partial<ArticleCatalogue> = {}): ArticleCatalogue => ({ ...UNWIRED_CATALOGUE, ...overrides });
const moderation = (overrides: Partial<ModerationReader> = {}): ModerationReader => ({ ...UNWIRED_MODERATION, ...overrides });

describe("the base article of a design", () => {
  it("is the design's own when it has one", async () => {
    const article = { baseArticleCode: "JSY-SS-01", productionClass: "A" as const, parameters: { body_length_offset: 10 } };
    expect(await articleOf(jersey({ article }), UNWIRED_CATALOGUE)).toEqual(article);
  });

  it("is the one the garment type maps to, with no parameters chosen", async () => {
    const mapped = catalogue({ articleForType: async () => ({ baseArticleCode: "JSY-SS-01", productionClass: "A" }) });
    expect(await articleOf(jersey(), mapped)).toEqual({ baseArticleCode: "JSY-SS-01", productionClass: "A", parameters: {} });
  });

  it("is null while no catalogue is wired, which raises no finding about parameters", async () => {
    expect(await articleOf(jersey(), UNWIRED_CATALOGUE)).toBeNull();
    expect(await UNWIRED_CATALOGUE.parameterDefs("JSY-SS-01")).toBeNull();
  });
});

describe("what moderation is asked about", () => {
  it("is every uploaded picture the design uses, once each, in a fixed order", async () => {
    const targets = moderationTargets(jersey({ artwork: LOGO_AND_TEXT }));
    expect(targets.length).toBe(1);
    expect(targets[0]).toMatchObject({ kind: "asset", label: "Club crest" });
    expect(moderationTargets(jersey({ artwork: LOGO_AND_TEXT }))).toEqual(targets);
  });

  it("is nothing for a design with no picture", () => {
    expect(moderationTargets(jersey())).toEqual([]);
  });

  it("is every asset a stored stack places as well: an uploaded one, a picture fill and an older logo file", () => {
    const targets = moderationTargets(withStoredStack(ALL_KINDS_STACK));
    expect(targets.map((target) => target.id)).toEqual(["6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f", "crest-1", "tile-1"]);
    expect(targets.every((target) => target.kind === "asset" && target.label.length > 0)).toBe(true);
  });

  it("names a layer with no name of its own in plain words, and never asks twice about one asset", () => {
    const layers = ALL_KINDS_STACK.layers.map((layer) => (layer.kind === "image-fill" ? { ...layer, name: undefined } : layer));
    const targets = moderationTargets(withStoredStack({ ...ALL_KINDS_STACK, layers }));
    expect(targets.find((target) => target.id === "tile-1")?.label).toBe("A picture");
    expect(new Set(targets.map((target) => target.id)).size).toBe(targets.length);
  });

  it("is nothing while no moderation is wired", async () => {
    expect(await UNWIRED_MODERATION.statusesFor("b", moderationTargets(jersey({ artwork: LOGO_AND_TEXT })))).toEqual([]);
  });
});

describe("the colours and the guardrail input of a stored design", () => {
  it("are the screen colours of the design and its pattern", () => {
    const colours = usedColours(jersey({ kitPattern: kitPatternOf("hoops") }));
    expect(colours.length).toBeGreaterThan(0);
    expect(colours.every((colour) => /^#[0-9a-f]{6}$/i.test(colour.hex))).toBe(true);
  });

  it("hold no placed item, because nothing yet places artwork on a panel on the server (decision 0045)", () => {
    const input = guardrailInputOf(jersey({ artwork: LOGO_AND_TEXT }));
    expect(input.panels).toEqual([]);
    expect(input.items).toEqual([]);
    expect(input.colours.length).toBeGreaterThan(0);
    expect(input.settings.minDpi.source).toBe("knitwright-default");
  });
});

describe("everything the checks read, through the ports", () => {
  it("is empty of article and moderation facts while neither port is wired", async () => {
    const input = await specInput(jersey({ artwork: LOGO_AND_TEXT }), "brand-1", UNWIRED_PORTS);
    expect(input).toMatchObject({ article: null, parameterDefs: null, moderation: [] });
    expect(input.guardrails.colours.length).toBeGreaterThan(0);
  });

  it("looks the article's parameters up once a catalogue answers, and asks moderation about the design's pictures", async () => {
    const asked: string[] = [];
    const ports = {
      catalogue: catalogue({
        articleForType: async () => ({ baseArticleCode: "JSY-SS-01", productionClass: "A" }),
        parameterDefs: async (code) => (asked.push(code), DEFS),
      }),
      moderation: moderation({ statusesFor: async (_brand, targets) => targets.map((target) => ({ target, result: "clear" as const })) }),
    };
    const input = await specInput(jersey({ artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS }), "brand-1", ports);
    expect(asked).toEqual(["JSY-SS-01"]);
    expect(input.parameterDefs).toEqual(DEFS);
    expect(input.moderation.map((one) => one.result)).toEqual(["clear"]);
  });

  it("does not ask the catalogue for parameters when the design is on no article", async () => {
    const asked: string[] = [];
    const ports = { catalogue: catalogue({ parameterDefs: async (code) => (asked.push(code), null) }), moderation: UNWIRED_MODERATION };
    expect((await specInput(jersey(), "brand-1", ports)).parameterDefs).toBeNull();
    expect(asked).toEqual([]);
  });
});

describe("the modules every validation runs", () => {
  it("are the five guardrails, parameters in range and moderation clear, each registered once", () => {
    const ids = standardRegistry().modules.map((module) => module.id);
    expect(ids).toEqual(["seam-crossing", "dpi", "bleed", "safe-zone", "gamut", "parameters-in-range", "moderation-clear"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

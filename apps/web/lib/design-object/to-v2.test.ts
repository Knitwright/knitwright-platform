import { readFileSync } from "node:fs";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { allDesigns, jersey, kitPatternOf, LOGO_AND_TEXT, MARKS } from "@/lib/artwork-stack/fixtures/designs";
import { ALL_KINDS_STACK, withStack as withStoredStack } from "@/lib/techpack/fixtures/stacks";
import { currentStack } from "@/lib/artwork-stack";
import { rolesOf } from "./colours";
import type { GarmentSpec } from "@/lib/garment";
import { toDesignObjectV2 } from "./to-v2";
import type { ArticleRef } from "@/lib/garment/spec-schema";
import type { DoAsset, ExportContext } from "./types";

/**
 * The export adapter, checked against the spec's own JSON Schema (docs/spec/schemas/design-object.schema.json).
 * The schema file is the contract; nothing here copies it.
 */

const schema: object = JSON.parse(readFileSync(new URL("../../../../docs/spec/schemas/design-object.schema.json", import.meta.url), "utf8"));
const validate: ValidateFunction = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const ARTICLE: ArticleRef = {
  baseArticleCode: "JSY-SS-01",
  productionClass: "A",
  parameters: { body_length_offset: 10, back_drop_tail: 20, side_split: false },
};
const context = (patch: Partial<ExportContext> = {}): ExportContext => ({ article: ARTICLE, ...patch });

const exported = (spec: GarmentSpec, patch: Partial<ExportContext> = {}) => {
  const result = toDesignObjectV2(spec, context(patch));
  if (!result.ok) throw new Error(result.reason);
  return result.object;
};

const errors = (): string => JSON.stringify(validate.errors);

describe("toDesignObjectV2", () => {
  const designs = allDesigns();

  it("has at least ten fixture designs to check", () => {
    expect(designs.length).toBeGreaterThanOrEqual(10);
  });

  it("checks against a schema that refuses a wrong object, so a green run means something", () => {
    expect(validate({})).toBe(false);
    expect(validate({ ...exported(jersey()), schema_version: "1.0" })).toBe(false);
    expect(validate({ ...exported(jersey()), unexpected: 1 })).toBe(false);
    expect(validate({ ...exported(jersey()), article: { ...exported(jersey()).article, base_article_code: "nope" } })).toBe(false);
  });

  it.each(designs.map((entry) => [entry.name, entry.spec] as const))("writes %s as a design object the spec's schema accepts", (_name, spec) => {
    const object = exported(spec);
    expect(validate(object), errors()).toBe(true);
  });

  it("accepts a design with artwork, a pattern and player marks", () => {
    const spec = jersey({ kitPattern: kitPatternOf("hoops"), artwork: LOGO_AND_TEXT, namesAndNumbers: MARKS });
    const object = exported(spec);
    expect(validate(object), errors()).toBe(true);
    expect(object.name_number.enabled).toBe(true);
    expect(object.name_number.zones.map((zone) => zone.kind)).toEqual(expect.arrayContaining(["name", "number", "front_number"]));
    expect(object.assets.length).toBeGreaterThan(0);
    expect(object.panels.some((panel) => panel.layers.some((layer) => layer.type === "pattern"))).toBe(true);
  });

  it("carries the article, its parameters and the garment's options", () => {
    const object = exported(jersey());
    expect(object.schema_version).toBe("2.0");
    expect(object.article).toMatchObject({ base_article_code: "JSY-SS-01", class: "A", parameters: ARTICLE.parameters });
    expect(Object.keys(object.article.options).length).toBeGreaterThan(0);
  });

  it("uses the fabric's catalogue code when the catalogue gives one, and the design's own fabric id when it does not", () => {
    expect(exported(jersey(), { fabricCode: "F-POLY-INT" }).article.fabric.code).toBe("F-POLY-INT");
    const spec = jersey();
    expect(exported(spec).article.fabric.code).toBe(spec.fabrics[0].id);
  });

  it("marks an asset pending until moderation has a result for it, and carries the result when it has one", () => {
    const spec = jersey({ artwork: LOGO_AND_TEXT });
    expect(exported(spec).assets.every((asset) => asset.moderation === "pending")).toBe(true);
    const ids = currentStack(spec).layers.flatMap((layer) => (layer.kind === "graphic" && layer.source.kind === "file" ? [layer.source.fileId] : []));
    const moderation = new Map<string, DoAsset["moderation"]>(ids.map((id) => [id, "clear"]));
    expect(exported(spec, { moderation }).assets.some((asset) => asset.moderation === "clear")).toBe(true);
  });

  it("says a colour role once per colour, in the shape the schema asks for", () => {
    const object = exported(jersey({ kitPattern: kitPatternOf("hoops") }));
    const roles = object.colourway.colours.map((colour) => colour.role);
    expect(new Set(roles).size).toBe(roles.length);
    expect(roles.every((role) => /^[a-z_]+$/.test(role))).toBe(true);
  });

  it("is the same object twice for the same design", () => {
    const spec = jersey({ kitPattern: kitPatternOf("sash"), artwork: LOGO_AND_TEXT });
    expect(exported(spec)).toEqual(exported(spec));
  });

  it("marks a design the assistant helped with, and one it did not", () => {
    expect(exported(jersey({ artwork: LOGO_AND_TEXT })).provenance.ai_assisted).toBe(true);
    expect(exported(jersey()).provenance.ai_assisted).toBe(false);
  });

  it("says the care label is custom only when the design holds care words", () => {
    expect(exported(jersey()).labels.care).toBe("auto");
    const spec = jersey({ labelling: { care: { text: "Wash at 30", provenance: "user-edited" } } });
    expect(exported(spec).labels.care).toBe("custom");
  });
});

describe("a design whose artwork is a stored stack", () => {
  const spec = withStoredStack(ALL_KINDS_STACK);

  it("is written as a design object the spec's schema accepts", () => {
    expect(validate(exported(spec)), errors()).toBe(true);
  });

  it("carries one layer per stack layer and view, in the stack's own order", () => {
    const front = exported(spec).panels.find((panel) => panel.panel_id === "front");
    expect(front?.layers.map((layer) => layer.type)).toEqual(["fill", "pattern", "artwork", "artwork", "artwork", "text"]);
  });

  it("names an uploaded asset by its id and an older logo file by its file id", () => {
    const ids = exported(spec).assets.map((asset) => asset.asset_id);
    expect(ids).toContain("crest-1");
    expect(ids.some((id) => id.startsWith("file-"))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("says how a picture fills a panel against its own scale, and places a graphic against its anchor", () => {
    const front = exported(spec).panels.find((panel) => panel.panel_id === "front");
    const fill = front?.layers.find((layer) => layer.scale !== undefined);
    expect(fill).toMatchObject({ type: "artwork", scale_by_size: "grade" });
    expect(front?.layers.some((layer) => layer.scale_by_size === "anchor" && layer.anchor !== undefined)).toBe(true);
  });

  it("takes the colourway's name from the stack", () => {
    expect(exported(spec).colourway.name).toBe("Home");
  });

  it("asks moderation about the stack's own assets", () => {
    const moderation = new Map<string, DoAsset["moderation"]>([["crest-1", "flagged"]]);
    expect(exported(spec, { moderation }).assets.find((asset) => asset.asset_id === "crest-1")?.moderation).toBe("flagged");
  });

  it("gives a colour whose id holds a digit a role of letters and underscores only", () => {
    const stack = { ...ALL_KINDS_STACK, colours: ALL_KINDS_STACK.colours.map((colour, at) => ({ ...colour, id: `kit-${at}` })) };
    const roles = rolesOf(stack).values();
    expect([...roles].every((role) => /^[a-z_]+$/.test(role))).toBe(true);
  });

  it("gives each colour its own role even when two ids shape into the same one", () => {
    const stack = {
      ...ALL_KINDS_STACK,
      colours: [
        { ...ALL_KINDS_STACK.colours[0]!, id: "kit-1" },
        { ...ALL_KINDS_STACK.colours[1]!, id: "kit-b" },
      ],
    };
    const roles = [...rolesOf(stack).values()];
    expect(new Set(roles).size).toBe(2);
    expect(roles).toContain("kit_b_x");
  });
});

describe("toDesignObjectV2 refuses rather than cut a design down", () => {
  it("refuses a design that is on no base article", () => {
    expect(toDesignObjectV2(jersey(), { article: null })).toEqual({
      ok: false,
      reason: "This design is not on a base article yet, so it cannot be written as a design object.",
    });
  });

  it("refuses a design whose colours have no screen colour", () => {
    const spec = jersey({ colourways: [{ id: "main", name: "Main", colours: [{ panelId: "body-front", colour: "Navy", provenance: "user-edited" }] }] });
    const result = toDesignObjectV2(spec, context());
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.reason).toContain("screen colour");
  });

  it("refuses a design with more colours than the format holds", () => {
    const colours = Array.from({ length: 9 }, (_at, at) => ({
      panelId: `body-${at}`,
      colour: `Colour ${at}`,
      swatch: `#0000${at}${at}`,
      provenance: "user-edited" as const,
    }));
    const spec = jersey({ colourways: [{ id: "main", name: "Main", colours }] });
    const result = toDesignObjectV2(spec, context());
    expect(!result.ok && result.reason).toBe("This design uses 9 colours; the export format holds 8.");
  });

  it("refuses a design whose printed text is longer than the format holds", () => {
    const text = "A".repeat(61);
    const spec = jersey({ artwork: [{ ...LOGO_AND_TEXT[1], source: { kind: "text", text } }] });
    const result = toDesignObjectV2(spec, context());
    expect(!result.ok && result.reason).toContain("longer than the 60 characters");
  });
});

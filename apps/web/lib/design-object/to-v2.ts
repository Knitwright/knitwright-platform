import { currentStack, type ArtworkStack } from "@/lib/artwork-stack";
import type { GarmentSpec } from "@/lib/garment";
import { colourwayColours, rolesOf } from "./colours";
import { assetsOf, marksOf, panelsOf, zonesOf } from "./layers";
import type { DesignObjectV2, DoAsset, DoLayer, ExportContext, ExportResult } from "./types";

/** The spec's colourway holds at most 8 colours, and a text layer at most 60 characters. */
const MAX_COLOURS = 8;
const MAX_TEXT = 60;

const AI_SOURCES: ReadonlySet<string> = new Set(["ai-suggested", "read-from-image"]);

/** True when anything in the design came from the assistant or was read from a picture. */
const aiAssisted = (spec: GarmentSpec, stack: ArtworkStack): boolean =>
  [
    ...Object.values(spec.options).map((choice) => choice.provenance),
    ...spec.measurements.map((entry) => entry.provenance),
    ...spec.artwork.map((entry) => entry.provenance),
    ...stack.layers.map((layer) => layer.provenance),
  ].some((source) => AI_SOURCES.has(source));

/** The text of a layer that is too long for the export format, or null. */
const longText = (layers: readonly DoLayer[]): string | null =>
  layers.find((layer) => (layer.text ?? "").length > MAX_TEXT)?.text ?? null;

const NO_ARTICLE = "This design is not on a base article yet, so it cannot be written as a design object.";

/** Why this design cannot be written as a design object, or null when it can. */
function refusal(parts: Readonly<{ colours: number; panels: readonly { layers: readonly DoLayer[] }[] }>): string | null {
  if (parts.colours === 0) {
    return "No colour of this design has a screen colour yet, and the export format needs at least one.";
  }
  if (parts.colours > MAX_COLOURS) {
    return `This design uses ${parts.colours} colours; the export format holds ${MAX_COLOURS}.`;
  }
  const text = longText(parts.panels.flatMap((panel) => panel.layers));
  return text === null ? null : `The text "${text.slice(0, 20)}…" is longer than the ${MAX_TEXT} characters the export format holds.`;
}

const nameNumber = (stack: ArtworkStack, roles: ReadonlyMap<string, string>): DesignObjectV2["name_number"] => {
  const marks = marksOf(stack);
  const first = marks[0];
  const role = first?.colourId === undefined ? undefined : roles.get(first.colourId);
  return {
    enabled: marks.length > 0,
    ...(first?.style === undefined ? {} : { font_id: first.style }),
    ...(role === undefined ? {} : { colour_role: role }),
    zones: zonesOf(stack),
  };
};

/** `ExportContext` once the article is known, which is what the design's own facts need. */
type FactsContext = Omit<ExportContext, "article"> & { readonly article: NonNullable<ExportContext["article"]> };

/**
 * The design's own facts in the design object's shape: its colourway, options, parameters, assets and fabric.
 *
 * This is what the design *is*. The export format's limits are not applied here: `toDesignObjectV2` applies them
 * and refuses. A caller that writes no techpack.json reads these instead — the production package
 * (`lib/kpp/sources/server.ts`) does, because it only reads the design's facts and then runs its own F-G2 gate
 * (`lib/kpp/gate.ts`), which names every gap in one refusal. Before this split the format's refusal ran first, so
 * a design whose colourway had no screen colour was turned away by the export format and never heard the gate's
 * own sentence about its care label (decision 0089, R3's review of plan v5, owner question 3b).
 */
export function designObjectFacts(spec: GarmentSpec, context: FactsContext): DesignObjectV2 {
  const { article } = context;
  const stack = currentStack(spec);
  const roles = rolesOf(stack);
  const colours = colourwayColours(stack, roles);
  const panels = panelsOf(stack, roles);
  const fabric = spec.fabrics[0];
  const moderation: ReadonlyMap<string, DoAsset["moderation"]> = context.moderation ?? new Map();
  return {
    schema_version: "2.0",
    article: {
      base_article_code: article.baseArticleCode,
      class: article.productionClass,
      parameters: article.parameters,
      options: Object.fromEntries(Object.entries(spec.options).map(([key, choice]) => [key, choice.choiceId])),
      fabric: { code: context.fabricCode ?? fabric.id, colour: null },
    },
    colourway: { name: stack.colourways[0]?.name ?? spec.colourways[0].name, colours },
    panels,
    assets: assetsOf(stack, moderation),
    name_number: nameNumber(stack, roles),
    labels: {
      care: spec.labelling.care === undefined ? "auto" : "custom",
      size: "auto",
      brand_label_asset_id: null,
    },
    provenance: { ai_assisted: aiAssisted(spec, stack) },
  };
}

/**
 * The design as the spec's design object, version 2.0 (`docs/spec/schemas/design-object.schema.json`).
 *
 * This is an export format for techpack.json and interop (plan v5 owner decision 4). It is produced from the stored
 * `GarmentSpec`, never stored itself, and it invents nothing: a design the format cannot hold is refused with the
 * reason, rather than cut down to fit. Panels are the design's views, which is what the stored stack holds; the base
 * article, the fabric's catalogue code and the moderation results are read through `ExportContext`, so the catalogue
 * (X1) and moderation (X8) fill them in when they are wired.
 */
export function toDesignObjectV2(spec: GarmentSpec, context: ExportContext): ExportResult {
  const { article } = context;
  if (article === null) return { ok: false, reason: NO_ARTICLE };
  const object = designObjectFacts(spec, { ...context, article });
  const refused = refusal({ colours: object.colourway.colours.length, panels: object.panels });
  return refused === null ? { ok: true, object } : { ok: false, reason: refused };
}

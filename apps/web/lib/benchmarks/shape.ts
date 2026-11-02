import type { BaseArticle, OptionDef } from "@/lib/catalogue";
import type { DesignObjectV2 } from "@/lib/design-object";
import type { DesignShape } from "./design-around";
import { FEATURES, type LayoutKind, type LayoutZone } from "./vocabulary";

/** A layer's kind, read off the design object rather than named again here. */
type LayerType = DesignObjectV2["panels"][number]["layers"][number]["type"];

/**
 * The design, read as a silhouette and a surface layout, so the design-around check can compare it with a benchmark
 * (spec F-S2 guardrails). The seam is the design object v2 (`lib/design-object`), which is a settled export shape, so
 * nothing here reaches into another workstream's stored types (Lesson 9).
 *
 * Two deliberate narrownesses. The silhouette is read **only** from options the base article itself offers and from
 * parameters it itself declares, so a design can never be said to share a feature its base cannot make. And the
 * layout is read as "something of this kind sits in this zone" and nothing finer: no shape, no size, no wording. A
 * layout comparison is about where artwork sits, not what it says, and keeping it that coarse is what stops the check
 * turning into a likeness test it has no business making.
 */

/** The design object's panel ids are the garment's views (lib/artwork-stack VIEW_IDS). */
const ZONE_OF_PANEL: Readonly<Record<string, LayoutZone>> = {
  front: "front",
  back: "back",
  "sleeve-left": "sleeve",
  "sleeve-right": "sleeve",
  collar: "collar",
};

/**
 * A layer kind as a layout kind. `pattern` becomes `block`: a tiled fill is an area of surface, and calling it a
 * stripe would claim a shape the design object does not state.
 */
const KIND_OF_LAYER: Readonly<Record<LayerType, LayoutKind>> = {
  fill: "block",
  gradient: "gradient",
  pattern: "block",
  artwork: "mark",
  text: "text",
};

const holds = (option: OptionDef, words: readonly string[]): boolean => {
  const haystack = `${option.label} ${option.code}`.toLowerCase();
  return words.some((word) => haystack.includes(word.toLowerCase()));
};

/** The features the chosen options amount to, in Knitwright's taxonomy. */
function featuresFromOptions(chosen: Readonly<Record<string, string>>, article: BaseArticle): readonly string[] {
  const codes = new Set(Object.values(chosen));
  const picked = article.options.filter((option) => codes.has(option.code));
  return FEATURES.filter((feature) => {
    const hint = feature.catalogue;
    if (hint?.words === undefined) return false;
    const inGroup = hint.optionGroup === undefined ? picked : picked.filter((option) => option.group === hint.optionGroup);
    return (inGroup.length > 0 ? inGroup : picked).some((option) => holds(option, hint.words ?? []));
  }).map((feature) => feature.key);
}

/**
 * A parameter counts as the feature it names only when the design has moved it away from nothing. A `back_drop_tail`
 * of 0 is not a drop tail, and saying it was would let the check warn about a shape the design does not have.
 */
function featuresFromParameters(values: Readonly<Record<string, number | string | boolean>>, article: BaseArticle): readonly string[] {
  const declared = new Set(article.parameters.map((parameter) => parameter.key));
  return FEATURES.filter((feature) => {
    const key = feature.catalogue?.parameterKey;
    if (key === undefined || !declared.has(key)) return false;
    const value = values[key];
    if (typeof value === "number") return value !== 0;
    if (typeof value === "boolean") return value;
    return typeof value === "string" && value.trim() !== "";
  }).map((feature) => feature.key);
}

const layoutOf = (panels: DesignObjectV2["panels"]): DesignShape["layout"] => {
  const seen = new Map<string, Readonly<{ zone: LayoutZone; kind: LayoutKind }>>();
  for (const panel of panels) {
    const zone = ZONE_OF_PANEL[panel.panel_id];
    if (zone === undefined) continue;
    for (const layer of panel.layers) {
      const kind = KIND_OF_LAYER[layer.type];
      seen.set(`${zone}:${kind}`, { zone, kind });
    }
  }
  return [...seen.values()];
};

/** The design's shape. With no article on file the silhouette is empty: a feature is never guessed from a code alone. */
export function designShapeFrom(object: DesignObjectV2, article: BaseArticle | null): DesignShape {
  const features =
    article === null
      ? []
      : [...new Set([...featuresFromParameters(object.article.parameters, article), ...featuresFromOptions(object.article.options, article)])];
  return { features, layout: layoutOf(object.panels) };
}

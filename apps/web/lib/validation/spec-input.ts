import type { GarmentSpec } from "@/lib/garment";
import type { ArticleRef } from "@/lib/garment/spec-schema";
import { DEFAULT_SETTINGS, type GuardrailInput, type UsedColour } from "@/lib/guardrails";
import { GUARDRAIL_CHECKS } from "./checks/guardrails";
import { moderationClear } from "./checks/moderation";
import { parametersInRange } from "./checks/parameters";
import type { ArticleCatalogue, ModerationTarget, ValidationPorts } from "./ports";
import { createCheckRegistry, type CheckRegistry, type DesignInput } from "./registry";

/** The base article of a design: its own, or the one its garment type maps to with no parameters chosen, or null. */
export async function articleOf(spec: GarmentSpec, catalogue: ArticleCatalogue): Promise<ArticleRef | null> {
  if (spec.article !== undefined) return spec.article;
  const mapped = await catalogue.articleForType(spec.typeId);
  return mapped === null ? null : { ...mapped, parameters: {} };
}

/**
 * Every uploaded picture the design uses, once each, in a fixed order. Two layers can place the same file; the first
 * name the design gives it is the one moderation is asked about, so the list does not change with the layer order.
 */
export function moderationTargets(spec: GarmentSpec): readonly ModerationTarget[] {
  const byId = new Map<string, ModerationTarget>();
  for (const art of spec.artwork) {
    const id = art.source.kind === "file" ? art.source.fileId : null;
    if (id !== null && !byId.has(id)) byId.set(id, { kind: "asset", id, label: art.name });
  }
  for (const layer of spec.artworkStack?.layers ?? []) {
    if (layer.kind === "graphic" || layer.kind === "image-fill") {
      const id = layer.kind === "image-fill" ? layer.assetId : layer.source.kind === "asset" ? layer.source.assetId : layer.source.fileId;
      if (!byId.has(id)) byId.set(id, { kind: "asset", id, label: layer.name ?? "A picture" });
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** The screen colours the design uses, as the variants code reads them (lib/variants). */
export const usedColours = (spec: GarmentSpec): UsedColour[] => [
  ...spec.colourways[0].colours.flatMap((entry) => (entry.swatch ? [{ id: entry.panelId, label: `The ${entry.panelId} colour`, hex: entry.swatch }] : [])),
  ...(spec.kitPattern?.colours ?? []).flatMap((entry, index) => (entry.swatch ? [{ id: `kit-pattern-${index}`, label: "A pattern colour", hex: entry.swatch }] : [])),
];

/**
 * The guardrail input that can be built from a stored design today. Nothing yet turns artwork into placed boxes on
 * pattern panels on the server (decision 0045), so only the colour estimate has input; the editor runs the rest live.
 */
export const guardrailInputOf = (spec: GarmentSpec): GuardrailInput => ({ panels: [], items: [], colours: usedColours(spec), settings: DEFAULT_SETTINGS });

/** Everything the X4 check modules read about a stored design, looked up through the ports. */
export async function specInput(
  spec: GarmentSpec,
  brandId: string,
  ports: ValidationPorts,
): Promise<Required<Pick<DesignInput, "article" | "parameterDefs" | "moderation" | "guardrails">>> {
  const article = await articleOf(spec, ports.catalogue);
  const [parameterDefs, moderation] = await Promise.all([
    article === null ? Promise.resolve(null) : ports.catalogue.parameterDefs(article.baseArticleCode),
    ports.moderation.statusesFor(brandId, moderationTargets(spec)),
  ]);
  return { article, parameterDefs, moderation, guardrails: guardrailInputOf(spec) };
}

/** The modules every validation runs: the five guardrails, parameters in range and moderation clear. */
export const standardRegistry = (): CheckRegistry => createCheckRegistry([...GUARDRAIL_CHECKS, parametersInRange, moderationClear]);

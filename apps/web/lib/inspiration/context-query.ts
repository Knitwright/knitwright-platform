import { KIT_PATTERN_LABELS, getType, panelsFor, type GarmentSpec } from "@/lib/garment";
import type { ContextQuery, ContextTag, TagSteer } from "./types";
import { MAX_TAGS, type TagKind } from "./vocabulary";

/**
 * The context query, built from the design object (spec F-S1, decision 0082): sport and base article, the names of the
 * dominant colours, the style tags of the chosen options, and the brand's mood words. The person pins or removes tags
 * to steer it. Nothing here reaches the network: the board hands this to each source.
 */

/** What the design and the workstreams beside it say about one design. Each list may be empty. */
export type ContextInput = Readonly<{
  /** The base article's sport tags (X1 catalogue), through the port. */
  sports: readonly string[];
  /** What the article is called: the catalogue name, else the garment type's label. */
  articleName: string | null;
  /** The names of the colours the design uses, in the order the colourway lists them. */
  colourNames: readonly string[];
  /** Style words from the chosen options and the kit pattern, such as "raglan" or "hoops". */
  styleTags: readonly string[];
  /** The brand kit's mood words (Y6), through the port. */
  moodWords: readonly string[];
}>;

const MAX_TAG_LENGTH = 40;

/** One tag's text: trimmed, lower case, inner runs of space squeezed, cut to length. */
export const tagText = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);

const tagsOf = (kind: TagKind, values: readonly string[]): ContextTag[] =>
  values.map((value) => ({ text: tagText(value), kind })).filter((tag) => tag.text !== "");

/** The tags the design implies, in kind order, each once. */
function impliedTags(input: ContextInput): readonly ContextTag[] {
  const all = [
    ...tagsOf("sport", input.sports),
    ...tagsOf("article", input.articleName === null ? [] : [input.articleName]),
    ...tagsOf("colour", input.colourNames),
    ...tagsOf("style", input.styleTags),
    ...tagsOf("mood", input.moodWords),
  ];
  const seen = new Set<string>();
  return all.filter((tag) => (seen.has(tag.text) ? false : (seen.add(tag.text), true)));
}

/**
 * The query the board searches with. The design's own tags come first in kind order; a tag the person pinned that the
 * design does not imply is added at the end, and a tag they removed is left out and remembered.
 */
export function buildContextQuery(input: ContextInput, steer: TagSteer = {}): ContextQuery {
  const removed = Object.entries(steer)
    .filter(([, state]) => state === "removed")
    .map(([text]) => tagText(text))
    .sort();
  const implied = impliedTags(input).filter((tag) => !removed.includes(tag.text));
  const pinnedOnly = Object.entries(steer)
    .filter(([, state]) => state === "pinned")
    .map(([text]) => tagText(text))
    .filter((text) => text !== "" && !implied.some((tag) => tag.text === text))
    .sort();
  const tags = [...implied, ...pinnedOnly.map((text): ContextTag => ({ text, kind: "pinned" }))].slice(0, MAX_TAGS);
  return { tags, text: tags.map((tag) => tag.text).join(" "), removed };
}

/** The steer with one tag pinned, removed, or back to how the design has it. */
export function steerTag(steer: TagSteer, text: string, state: "pinned" | "removed" | null): TagSteer {
  const key = tagText(text);
  if (key === "") return steer;
  const next = { ...steer };
  if (state === null) delete next[key];
  else next[key] = state;
  return next;
}

/** The style words the chosen options and the kit pattern give, as the registry labels them. */
export function styleTagsOf(spec: GarmentSpec): readonly string[] {
  const type = getType(spec.typeId);
  const chosen = Object.entries(spec.options).flatMap(([optionId, choice]) => {
    const option = type?.options.find((entry) => entry.id === optionId);
    const label = option?.choices.find((entry) => entry.id === choice.choiceId)?.label;
    return label === undefined ? [] : [`${label} ${option?.label ?? ""}`.trim().toLowerCase()];
  });
  const pattern = spec.kitPattern ? [KIT_PATTERN_LABELS[spec.kitPattern.style].toLowerCase()] : [];
  return [...pattern, ...chosen];
}

/** The colour names the design uses: the words a person typed, never a hex code and never a panel id. */
export function colourNamesOf(spec: GarmentSpec): readonly string[] {
  const panels = spec.colourways[0].colours.flatMap((entry) => (entry.colour.trim() === "" ? [] : [entry.colour]));
  const pattern = (spec.kitPattern?.colours ?? []).flatMap((entry) => (entry.colour.trim() === "" ? [] : [entry.colour]));
  return [...panels, ...pattern];
}

/** The context the design itself can answer for. The sports and the mood words come through the ports. */
export function designContext(spec: GarmentSpec, extra: Readonly<{ sports: readonly string[]; articleName: string | null; moodWords: readonly string[] }>): ContextInput {
  return {
    sports: extra.sports,
    articleName: extra.articleName ?? getType(spec.typeId)?.label ?? null,
    colourNames: colourNamesOf(spec),
    styleTags: styleTagsOf(spec),
    moodWords: extra.moodWords,
  };
}

/** The panel ids a design has, so a suggestion can only name a panel the base article really carries. */
export const panelIdsOf = (spec: GarmentSpec): readonly string[] => panelsFor(spec).map((panel) => panel.id);

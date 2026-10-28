import { buildArtwork } from "./artwork";
import { buildColourways } from "./colourways";
import { completenessReport } from "./completeness";
import { buildComponents } from "./components";
import { buildConstruction } from "./construction";
import { buildCover } from "./cover";
import { buildFlatsSection } from "./flats";
import type { TechPackInput } from "./input";
import { buildLabelling } from "./labelling";
import { buildHowToMeasure, buildMeasurements } from "./measurements";
import { buildArtworkAndColour, coloursFor } from "./production/artwork-colour";
import { buildFabric } from "./production/fabric";
import { buildOnPattern } from "./production/measured";
import { buildOperations } from "./production/operations";
import { buildPatternAndCutting } from "./production/pattern-cutting";
import { buildReadiness } from "./production/readiness";
import { stackOf } from "./production/stack-source";
import { strikeOffForRelease } from "./production/strike-off";
import { buildSignOff } from "./sign-off";
import { buildSuggested } from "./suggested";
import type { SectionHead, TechPack } from "./types";

const head = ({ id, title, note }: SectionHead): SectionHead => ({ id, title, note });

/** The sections made from the production records: the pattern, the fabric, the artwork and colour, and the order of work. */
function productionSections(
  production: NonNullable<TechPackInput["production"]>,
  colourways: TechPack["colourways"],
  construction: TechPack["construction"],
  technique: string | null,
  hasPlayerMarks: boolean,
) {
  return {
    patternAndCutting: buildPatternAndCutting({ pattern: production.pattern, review: production.review, fabric: production.fabric, marker: production.marker }),
    fabric: buildFabric(production.fabric, production.blockReduction),
    artworkAndColour: buildArtworkAndColour(production, colourways, technique),
    operations: buildOperations(technique, construction, hasPlayerMarks),
  };
}

type Pack = Omit<TechPack, "readiness" | "suggested" | "sections">;

/** Whether the pack is ready to order: the production records checked against what the pack says. */
function readinessOf(
  spec: TechPackInput["spec"],
  pack: Pack,
  suggested: TechPack["suggested"],
  parts: { production: Parameters<typeof buildReadiness>[0]["input"]; stack: ReturnType<typeof stackOf>; colourways: TechPack["colourways"] },
) {
  const { production, stack, colourways } = parts;
  const { measurements, artwork } = pack;
  return buildReadiness({
    input: production,
    orderedSizes: measurements.columns.flatMap((column) => (column.size === null ? [] : [column.size])),
    measurements,
    onPattern: measurements.onPattern,
    completeness: completenessReport({ ...pack, suggested }),
    colours: coloursFor(production, stack, colourways),
    needsRoster: spec.namesAndNumbers !== undefined || artwork.playerMarks.length > 0,
    artwork: pack.artworkAndColour,
  });
}

/** The section heads in reading order. */
const sectionsOf = (pack: Pack, readiness: TechPack["readiness"], suggested: TechPack["suggested"]): SectionHead[] =>
  [
    pack.cover,
    readiness,
    pack.flats,
    pack.measurements,
    pack.howToMeasure,
    pack.patternAndCutting,
    pack.components,
    pack.fabric,
    pack.construction,
    pack.colourways,
    pack.artwork,
    pack.artworkAndColour,
    pack.operations,
    pack.labelling,
    suggested,
    pack.signOff,
  ].map(head);

/**
 * The tech pack document for one version of a design. It is a pure function of its input:
 * no clock, no database, no network. Each section is made from the design alone, so the
 * drawing, the measurement table and this document cannot disagree. Every section is
 * present even when it is empty, and says what is missing.
 */
export function buildTechPack(input: TechPackInput): TechPack {
  const { spec, charts } = input;
  const stack = stackOf(spec, input.production ?? {});
  const production = { ...input.production, stack };
  const measured = buildMeasurements(spec, charts);
  const measurements = { ...measured, onPattern: buildOnPattern(measured, production.measured ?? [], production.sizeMap ?? [], production.patternOnlyTargets ?? []) };
  const colourways = buildColourways(spec, charts);
  const construction = buildConstruction(spec);
  const artwork = buildArtwork(spec, stack);
  const technique = production.technique ?? spec.kitPattern?.technique ?? spec.artwork[0]?.technique ?? stack?.layers.find((layer) => layer.technique !== undefined)?.technique ?? null;
  const pack = {
    title: "Tech pack",
    printedOn: input.printedOn,
    printedOnIso: input.printedOnIso,
    cover: buildCover(input),
    flats: buildFlatsSection(spec, input.flats, charts),
    measurements,
    howToMeasure: buildHowToMeasure(spec),
    components: buildComponents(spec),
    construction,
    colourways,
    artwork,
    labelling: buildLabelling(spec),
    signOff: buildSignOff(production.signOffs, strikeOffForRelease(production)),
    ...productionSections(production, colourways, construction, technique, artwork.playerMarks.length > 0),
  };
  const suggested = buildSuggested(pack);
  const readiness = readinessOf(spec, pack, suggested, { production, stack, colourways });
  const sections = sectionsOf(pack, readiness, suggested);
  return { ...pack, readiness, suggested, sections };
}

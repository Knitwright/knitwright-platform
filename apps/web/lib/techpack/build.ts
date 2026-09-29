import { buildArtwork } from "./artwork";
import { buildColourways } from "./colourways";
import { buildComponents } from "./components";
import { buildConstruction } from "./construction";
import { buildCover } from "./cover";
import { buildFlatsSection } from "./flats";
import type { TechPackInput } from "./input";
import { buildLabelling } from "./labelling";
import { buildHowToMeasure, buildMeasurements } from "./measurements";
import { buildSignOff } from "./sign-off";
import { buildSuggested } from "./suggested";
import type { SectionHead, TechPack } from "./types";

const head = ({ id, title, note }: SectionHead): SectionHead => ({ id, title, note });

/**
 * The tech pack document for one version of a design. It is a pure function of its input:
 * no clock, no database, no network. Each section is made from the design alone, so the
 * drawing, the measurement table and this document cannot disagree. Every section is
 * present even when it is empty, and says what is missing.
 */
export function buildTechPack(input: TechPackInput): TechPack {
  const { spec, charts } = input;
  const measurements = buildMeasurements(spec, charts);
  const pack = {
    title: "Tech pack",
    printedOn: input.printedOn,
    cover: buildCover(input),
    flats: buildFlatsSection(spec, input.flats),
    measurements,
    howToMeasure: buildHowToMeasure(spec),
    components: buildComponents(spec),
    construction: buildConstruction(spec),
    colourways: buildColourways(spec),
    artwork: buildArtwork(spec),
    labelling: buildLabelling(spec),
    suggested: buildSuggested(spec, charts, measurements),
    signOff: buildSignOff(),
  };
  const sections = [
    pack.cover,
    pack.flats,
    pack.measurements,
    pack.howToMeasure,
    pack.components,
    pack.construction,
    pack.colourways,
    pack.artwork,
    pack.labelling,
    pack.suggested,
    pack.signOff,
  ].map(head);
  return { ...pack, sections };
}

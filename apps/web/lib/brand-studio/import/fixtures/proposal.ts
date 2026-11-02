import { LOGO_RIGHTS } from "@/lib/consent/wording";
import { itemsOf } from "../items";
import { colourOf, seenColours } from "../palette";
import type { ImportProposal, ImportedColour, ImportedFont, ImportedStyle, PictureFacts, StageReport } from "../types";
import { IMPORT_STAGES, RIGHTS_ASK } from "../words";
import { kitFonts } from "./site";
import { proposedFonts } from "../fonts";

/** A finished proposal, built without a fetch, for the tests of the decisions, the plan and the view. */

export const SITE = "https://ravensmoor.test";

export const facts = (over: Partial<PictureFacts> = {}): PictureFacts => ({
  url: `${SITE}/media/logo.png`,
  why: "img-logo",
  alt: "Ravensmoor Athletic crest",
  contentType: "image/png",
  widthPx: 512,
  heightPx: 512,
  bytes: 12_000,
  swatches: [{ hex: "#0b1f4b", share: 0.8 }],
  ...over,
});

export const colours = (hexes: readonly string[] = ["#0b1f4b", "#ffd100"]): readonly ImportedColour[] =>
  seenColours(hexes, []).map(colourOf);

export const fonts = (): readonly ImportedFont[] => proposedFonts(["Bebas Neue", "Source Serif 4"], kitFonts());

export const style = (): ImportedStyle => ({
  setting: "A wet pitch at dusk, read from your own pictures.",
  artDirection: "Long lens, low light.",
  rulesBoundaries: "Never a sponsor on the sleeve.",
});

const done = (stage: StageReport["stage"], found: number): StageReport => ({ stage, status: found === 0 ? "empty" : "done", found, because: null, tookMs: 10 });

export const proposal = (over: Partial<ImportProposal> = {}): ImportProposal => {
  const found = {
    logos: [facts()],
    graphics: [facts({ url: `${SITE}/media/shirt-1.png`, why: "img-product", alt: "Home shirt 1" })],
    colours: colours(),
    fonts: fonts(),
    style: style(),
    ...over,
  };
  return {
    url: `${SITE}/`,
    host: "ravensmoor.test",
    fetchedAt: "2026-11-02T09:00:00.000Z",
    stages: IMPORT_STAGES.map((stage) => done(stage, 1)),
    items: itemsOf(found),
    colours: found.colours,
    fonts: found.fonts,
    logos: found.logos,
    graphics: found.graphics,
    style: found.style,
    rights: { ticked: false, wordingVersion: LOGO_RIGHTS.version, text: LOGO_RIGHTS.text, ask: RIGHTS_ASK },
    styleWriter: "stub",
    ...over,
  };
};

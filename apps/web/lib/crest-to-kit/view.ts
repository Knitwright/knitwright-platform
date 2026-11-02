import { DEFAULT_MARKET } from "@/lib/home/market";
import { configuratorHref, kitStateOf } from "@/lib/teamwear/address";
import { quoteHref } from "@/lib/quotes/download";
import { kitParts } from "@/lib/teamwear/kit";
import type { KitRun } from "./service";
import { DELTA_BASIS, PANTONE_GAP, type CrestColour } from "./palette";
import type { ValidatedCandidate } from "./validate";

/**
 * What the screen draws, as plain data (spec F-T2 step 5, "see 6-9 complete kits as cards").
 *
 * The view model is built on the SERVER and sent to the browser as JSON, and the components import
 * only its TYPES. That is deliberate: it keeps the garment rules, and so zod, out of the browser
 * (`tests/architecture/client-weight.test.ts`), and it means the browser is never handed a kit it
 * could change — a card carries words, swatches, catalogue codes and two addresses, and nothing
 * the configurator does not read back from the address itself.
 *
 * Every figure on a card comes from somewhere: a code from the base article, a colour from the
 * palette, a difference from `lib/colour`'s own basis. Nothing is rounded into a claim.
 */

export interface SwatchView {
  /** The colour as the crest has it. */
  readonly hex: string;
  /** The colour a sublimation print is estimated to reach. The same colour when it already is. */
  readonly safeHex: string;
  readonly inGamut: boolean;
  /** "Navy", from Knitwright's own named list, or null when there is no list to read. */
  readonly name: string | null;
  /** How far apart the two colours are, as CIEDE2000, to one decimal place. */
  readonly delta: string;
  /** The sentence to show where the estimate had to move the colour, else null. */
  readonly warning: string | null;
  /** What share of the crest this colour covers, as a percentage a person reads. */
  readonly share: string;
}

export interface KitCardView {
  readonly id: string;
  /** "Home kit · Stripes", the two things a club picks a card by. */
  readonly title: string;
  /** The one line about this kit. Knitwright's own, or a ranker's where one was allowed. */
  readonly note: string;
  /** The colours of the kit, body first. These are the colours the card draws. */
  readonly colours: readonly string[];
  readonly socksColour: string;
  /** The catalogue codes the factory reads, such as `P01 · C01 · K01`. */
  readonly codes: string;
  /** How far this kit's body colour sits from the crest's dominant colour, or null. */
  readonly delta: string | null;
  /** Where the card opens: the kit itself, in the configurator. */
  readonly href: string;
  /** Where the quote for this kit is. */
  readonly quoteHref: string;
  /** Every warning the checks raised about this kit. A blocker would have kept the card off. */
  readonly warnings: readonly string[];
  readonly ruleIds: readonly string[];
}

export interface KitsView {
  readonly status: "kits" | "none";
  /** The reason there are no kits, or null when there are some. */
  readonly reason: string | null;
  readonly palette: readonly SwatchView[];
  /** What the vectorise check said, or null when the club picked colours instead. */
  readonly vectorise: string | null;
  readonly sharpEnough: boolean;
  readonly kits: readonly KitCardView[];
  /** Everything the club has to be told: a role, a family or a kit that could not be offered. */
  readonly notes: readonly string[];
  /** The two sentences that must appear wherever a colour is shown. */
  readonly colourBasis: readonly string[];
}

const percent = (share: number): string => `${Math.round(share * 100)}%`;
const oneDecimal = (value: number): string => value.toFixed(1);

export const swatchView = (colour: CrestColour): SwatchView => ({
  hex: colour.hex,
  safeHex: colour.safeHex,
  inGamut: colour.inGamut,
  name: colour.reference?.name ?? null,
  delta: oneDecimal(colour.deltaE00),
  warning: colour.warning,
  share: percent(colour.share),
});

/** The quantity a card's quote is asked for: the configurator's own starting quantity. */
const quantityOf = (one: ValidatedCandidate): readonly Readonly<{ articleCode: string; qty: number }>[] =>
  kitParts(one.candidate.kit).flatMap((part) => (part.articleCode === null ? [] : [{ articleCode: part.articleCode, qty: part.choice.quantity }]));

/** The parts of a kit the catalogue does not cover, by the label a club reads. */
const unpricedOf = (one: ValidatedCandidate): readonly string[] =>
  kitParts(one.candidate.kit).flatMap((part) => (part.articleCode === null ? [part.label] : []));

export function kitCardView(one: ValidatedCandidate, clubName: string | null): KitCardView {
  const { candidate } = one;
  const codes = Object.values(candidate.kit.parts.shirt?.form.options ?? {}).join(" · ");
  const lines = quantityOf(one);
  return {
    id: candidate.id,
    title: `${candidate.roleLabel} kit · ${candidate.familyLabel}`,
    note: candidate.note,
    colours: [candidate.kit.colours.main, candidate.kit.colours.second, ...(candidate.kit.colours.third === null ? [] : [candidate.kit.colours.third])],
    socksColour: candidate.kit.socksColour,
    codes,
    delta: candidate.primaryDeltaE00 === null ? null : oneDecimal(candidate.primaryDeltaE00),
    href: configuratorHref({ sportId: candidate.sportId, part: "shirt", kit: kitStateOf(candidate.kit, "shirt") }),
    quoteHref: quoteHref({
      sportId: candidate.sportId,
      // This screen has no market selector, so a quote is asked for in the market the catalogue and
      // the configurator open in. A club in another market changes it in the configurator, which is
      // where the price is shown.
      currency: DEFAULT_MARKET.currency,
      clubName,
      lines,
      unpriced: unpricedOf(one),
      crest: candidate.kit.elements.includes("crest"),
      namesNumbers: candidate.kit.namesNumbers,
    }),
    // Each part of the kit is checked against the same factory profile, so the profile's own open
    // items — no minimum order, no lead time, no price ladder — come back once per part. A club
    // reads them once: the same sentence three times over says nothing three times over.
    warnings: [...new Set(one.validation.findings.filter((finding) => finding.severity === "warning").map((finding) => finding.message))],
    ruleIds: [...new Set([...candidate.ruleIds, ...one.validation.ruleIds])],
  };
}

/** The whole screen as data. A run with no kits carries its reason and its palette either way. */
export function kitsView(run: KitRun, clubName: string | null): KitsView {
  const common = {
    palette: run.palette.map(swatchView),
    vectorise: run.vectorise?.message ?? null,
    sharpEnough: run.vectorise?.sharpEnough ?? true,
    colourBasis: [PANTONE_GAP, DELTA_BASIS],
  };
  if (run.status === "none") return { status: "none", reason: run.reason, kits: [], notes: run.notes, ...common };
  return { status: "kits", reason: null, kits: run.kits.map((one) => kitCardView(one, clubName)), notes: run.notes, ...common };
}

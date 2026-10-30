import type { BaseArticle } from "@/lib/catalogue";
import { baseArticleForType } from "@/lib/catalogue";
import { defaultForm, defaultsOver, type FormValues } from "@/lib/editor";
import type { Wearer } from "@/lib/garment";
import { DEFAULT_CLUB_COLOURS, type ClubColours } from "@/lib/kit-styles/presets";
import { KIT_PARTS, KIT_PART_LABELS, sportById, type KitPartId, type SportDefinition } from "./vocabulary";

/**
 * The kit a club is configuring (spec F-T1). It is one plain value: the sport, the club's colours,
 * the socks colour, and for each part the base article's form (its option codes and its parameters
 * in millimetres) and the quantity. Nothing in it is a picture and nothing in it is
 * stored until Save, so every change makes one new value and the undo stack is a list of them.
 *
 * The form is the editor's own `FormValues` (decision 0075), resolved by `defaultsOver`, so a kit
 * can only ever hold an option the article offers and a parameter inside the range the factory
 * approved. That is why "Design in Studio" can hand the same form straight to the editor.
 */

/** A kit part as the configurator offers it: which registry type it is, and which base article stands behind it. */
export interface KitPart {
  readonly id: KitPartId;
  readonly label: string;
  readonly typeId: string;
  /** The base article code, or null where the catalogue does not cover the type (socks, caps, trousers). */
  readonly articleCode: string | null;
}

/** The fixed element slots the spec names: the crest, up to three sponsors and one text element. */
export const ELEMENT_SLOTS = ["crest", "sponsor-1", "sponsor-2", "sponsor-3", "text"] as const;
export type ElementSlotId = (typeof ELEMENT_SLOTS)[number];

export const ELEMENT_SLOT_LABELS: Readonly<Record<ElementSlotId, string>> = {
  crest: "Crest",
  "sponsor-1": "Main sponsor",
  "sponsor-2": "Second sponsor",
  "sponsor-3": "Third sponsor",
  text: "Text",
};

/** What the person has chosen for one part of the kit. */
export interface PartChoice {
  /** The base article's form: an option code per group and a value in millimetres per parameter. */
  readonly form: FormValues;
  readonly quantity: number;
  /** The decision rows the person has settled on this part. The pill's tick reads this. */
  readonly settled: readonly string[];
}

export interface TeamwearKit {
  readonly sportId: string;
  /** Who the kit is made for, from the registry's own list. It decides the size run, so it is a decision row. */
  readonly wearer: Wearer;
  /** The club's colours, used on every part so a kit reads as one kit. */
  readonly colours: ClubColours;
  /** The socks colour. Socks have no base article yet, so a colour is all a kit can hold for them. */
  readonly socksColour: string;
  /** The bundle template last applied, or null when the person set the colours themselves. */
  readonly bundleId: string | null;
  readonly namesNumbers: boolean;
  readonly elements: readonly ElementSlotId[];
  readonly parts: Readonly<Record<string, PartChoice>>;
}

/** How many pieces a stepper starts at. The factory's own minimum is shown beside it, never instead of it. */
export const DEFAULT_QUANTITY = 20;

/**
 * Who a kit is made for until the person says. The registry offers men, women and youth and names
 * no default, so the first of its own list is used and the row asks for a choice.
 */
export const DEFAULT_WEARER: Wearer = "men";

/** The parts a sport offers, in pill order. A part the sport has no registry type for is left out. */
export function partsForSport(sport: SportDefinition): readonly KitPart[] {
  return KIT_PARTS.flatMap((id) => {
    const typeId = sport.parts[id];
    if (typeId === null) return [];
    return [{ id, label: KIT_PART_LABELS[id], typeId, articleCode: baseArticleForType(typeId) ?? null }];
  });
}

export const partOf = (sport: SportDefinition, id: KitPartId): KitPart | undefined =>
  partsForSport(sport).find((part) => part.id === id);

/** The articles a configurator was given, by code. A part whose article could not be read has none. */
export type ArticleBook = ReadonlyMap<string, BaseArticle>;

/** The article behind a part, or null where the catalogue does not cover it or could not be read. */
export const articleOf = (part: KitPart, articles: ArticleBook): BaseArticle | null =>
  part.articleCode === null ? null : articles.get(part.articleCode) ?? null;

/** A kit at its starting values: the sport's parts, each on its article's own defaults, in the club's colours. */
export function startingKit(sportId: string, articles: ArticleBook, colours: ClubColours = DEFAULT_CLUB_COLOURS): TeamwearKit {
  const sport = sportById(sportId);
  const parts: Record<string, PartChoice> = {};
  for (const part of partsForSport(sport)) {
    parts[part.id] = { form: defaultForm(articleOf(part, articles)), quantity: DEFAULT_QUANTITY, settled: [] };
  }
  return { sportId: sport.id, wearer: DEFAULT_WEARER, colours, socksColour: colours.second, bundleId: null, namesNumbers: false, elements: [], parts };
}

/** A kit with one part changed. A part the kit does not hold is left alone. */
export function withPart(kit: TeamwearKit, id: KitPartId, change: (choice: PartChoice) => PartChoice): TeamwearKit {
  const current = kit.parts[id];
  if (!current) return kit;
  return { ...kit, parts: { ...kit.parts, [id]: change(current) } };
}

/** The same choice with a decision row marked settled. Settling a row twice changes nothing. */
export const settle = (choice: PartChoice, rowId: string): PartChoice =>
  choice.settled.includes(rowId) ? choice : { ...choice, settled: [...choice.settled, rowId] };

/**
 * The kit with one row settled on every part. A row that belongs to the whole kit — the colours, who
 * it is made for — is answered once, so the pill row ticks the whole kit at once. That is what lets
 * a club finish a kit inside the spec's ninety seconds.
 */
export const settleEverywhere = (kit: TeamwearKit, rowId: string): TeamwearKit => ({
  ...kit,
  parts: Object.fromEntries(Object.entries(kit.parts).map(([id, choice]) => [id, settle(choice, rowId)] as const)),
});

/**
 * A part with one option group set to a catalogue code, and the row marked settled. The form goes
 * through the editor's own resolver, so a code the article does not offer falls back to the
 * article's default rather than being kept.
 */
export function chooseOption(choice: PartChoice, article: BaseArticle | null, group: string, code: string, rowId: string): PartChoice {
  if (!article) return choice;
  const form = defaultsOver(article, { options: { ...choice.form.options, [group]: code }, parameters: choice.form.parameters });
  return settle({ ...choice, form }, rowId);
}

/**
 * A part with one parameter set, in millimetres. A value outside the article's approved range, or off
 * its step, falls back to the article's default: the control cannot reach it and this refuses it again.
 */
export function chooseParameter(choice: PartChoice, article: BaseArticle | null, key: string, mm: number, rowId: string): PartChoice {
  if (!article) return choice;
  const form = defaultsOver(article, { options: choice.form.options, parameters: { ...choice.form.parameters, [key]: mm } });
  return settle({ ...choice, form }, rowId);
}

/** The kit's parts in pill order, with the part's own choice. */
export function kitParts(kit: TeamwearKit): readonly (KitPart & Readonly<{ choice: PartChoice }>)[] {
  return partsForSport(sportById(kit.sportId)).flatMap((part) => {
    const choice = kit.parts[part.id];
    return choice ? [{ ...part, choice }] : [];
  });
}

/** Every piece in the kit: the quantity the tier is read at (spec F-T5, counted across the basket). */
export const totalPieces = (kit: TeamwearKit): number => kitParts(kit).reduce((sum, part) => sum + part.choice.quantity, 0);

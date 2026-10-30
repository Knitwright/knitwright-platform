import { resolveForm, withEditorState, writeForm, type FormValues } from "@/lib/editor";
import type { BaseArticle } from "@/lib/catalogue";
import { SWATCH_PATTERN, WEARERS, type Wearer } from "@/lib/garment";
import type { ClubColours } from "@/lib/kit-styles/presets";
import { articleOf, partOf, startingKit, withPart, type ArticleBook, type PartChoice, type TeamwearKit } from "./kit";
import { clampQuantity } from "./pricing";
import { KIT_PARTS, sportById, type KitPartId } from "./vocabulary";

/**
 * The configurator's own address, and the address "Design in Studio" opens.
 *
 * Nothing is stored until Save: a configurator that saved on every tap would make a design version
 * per colour. So the kit lives in the address instead — the sport, the part showing, who it is for,
 * the colours, the quantity and the base article's form. A reload, a shared link and the page the
 * Save action comes back to therefore all open the same kit, and the server reads the right base
 * articles and the right price ladder from the same address.
 *
 * Every value is checked on the way in: a colour that is not a colour, a wearer the registry does
 * not know, a part the sport does not offer and an option code the article does not offer are all
 * dropped, so no hand-written address can make an unmanufacturable kit.
 *
 * "Design in Studio" opens the saved design in the Y2 editor with the very form the configurator
 * had, through the editor's own `withEditorState` (decision 0075). The form travels in the address
 * rather than in the design because no change in the design contract writes a base article's
 * parameters yet; the editor reads it back with `readAddress` and re-drafts, so the editor shows
 * the same kit the club just configured.
 */

export const PARAMS = {
  sport: "sport",
  part: "part",
  market: "market",
  view: "view",
  project: "project",
  version: "v",
  wearer: "for",
  main: "c1",
  second: "c2",
  third: "c3",
  socks: "cs",
  quantity: "qty",
  /** One `group:CODE` per option group, as the editor writes them. */
  option: "opt",
  /** One `key:millimetres` per parameter, as the editor writes them. */
  parameter: "par",
} as const;

export type Query = Readonly<Record<string, string | readonly string[] | undefined>>;

const list = (value: string | readonly string[] | undefined): readonly string[] =>
  value === undefined ? [] : typeof value === "string" ? [value] : value;

const first = (value: string | readonly string[] | undefined): string | null => list(value)[0] ?? null;

/** A colour from the address, or null when it is not one. */
const swatch = (value: string | readonly string[] | undefined): string | null => {
  const asked = first(value);
  return asked !== null && SWATCH_PATTERN.test(asked) ? asked : null;
};

/** `key:value` pairs out of a repeated parameter. A pair without a colon is dropped, as the editor drops it. */
function pairs(value: string | readonly string[] | undefined): Readonly<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const entry of list(value)) {
    const at = entry.indexOf(":");
    if (at <= 0 || at === entry.length - 1) continue;
    found[entry.slice(0, at)] = entry.slice(at + 1);
  }
  return found;
}

/** The part the right panel is showing. Anything the sport does not offer falls back to its first part. */
export function parsePart(query: Query, sportId: string): KitPartId {
  const sport = sportById(sportId);
  const asked = first(query[PARAMS.part]);
  const offered = KIT_PARTS.filter((id) => sport.parts[id] !== null);
  return offered.find((id) => id === asked) ?? offered[0] ?? "shirt";
}

export const parseSport = (query: Query): string => sportById(first(query[PARAMS.sport])).id;

/** The saved design the configurator is showing, or null when nothing has been saved yet. */
export function parseSaved(query: Query): Readonly<{ projectId: string; version: number }> | null {
  const projectId = first(query[PARAMS.project]);
  const version = Number(first(query[PARAMS.version]));
  if (projectId === null || !/^[0-9a-f-]{36}$/.test(projectId)) return null;
  return Number.isInteger(version) && version >= 1 ? { projectId, version } : null;
}

/** Everything of a kit the address can carry, unchecked against any article. */
export interface KitAddress {
  readonly sportId: string;
  readonly part: KitPartId;
  readonly wearer: Wearer | null;
  readonly colours: ClubColours | null;
  readonly socksColour: string | null;
  readonly quantity: number | null;
  readonly options: Readonly<Record<string, string>>;
  readonly parameters: Readonly<Record<string, string>>;
}

export function readKitAddress(query: Query): KitAddress {
  const sportId = parseSport(query);
  const main = swatch(query[PARAMS.main]);
  const second = swatch(query[PARAMS.second]);
  const quantity = Number(first(query[PARAMS.quantity]));
  const wearer = first(query[PARAMS.wearer]);
  return {
    sportId,
    part: parsePart(query, sportId),
    wearer: WEARERS.find((entry) => entry === wearer) ?? null,
    // Both of the first two colours or neither: half a palette is not a kit's colours.
    colours: main !== null && second !== null ? { main, second, third: swatch(query[PARAMS.third]) } : null,
    socksColour: swatch(query[PARAMS.socks]),
    quantity: Number.isInteger(quantity) && quantity >= 1 ? quantity : null,
    options: pairs(query[PARAMS.option]),
    parameters: pairs(query[PARAMS.parameter]),
  };
}

/**
 * The kit an address asks for: the sport's starting kit with everything the address carries laid
 * over it. The form goes through the editor's own `resolveForm`, so an option code the article does
 * not offer and a parameter outside the range the factory approved fall back to the article's own
 * default rather than being kept.
 */
export function kitFromAddress(address: KitAddress, articles: ArticleBook): TeamwearKit {
  const base = startingKit(address.sportId, articles, address.colours ?? undefined);
  const kit: TeamwearKit = {
    ...base,
    wearer: address.wearer ?? base.wearer,
    socksColour: address.socksColour ?? base.socksColour,
  };
  const part = partOf(sportById(address.sportId), address.part);
  if (!part) return kit;
  const article: BaseArticle | null = articleOf(part, articles);
  return withPart(kit, address.part, (choice) => ({
    ...choice,
    form: article === null ? choice.form : resolveForm(article, { options: address.options, parameters: address.parameters }),
    quantity: address.quantity === null ? choice.quantity : clampQuantity(address.quantity, 1),
  }));
}

/** What the address carries about the kit itself: what both the screen and the Save action can hand over. */
export interface KitState {
  readonly wearer: Wearer;
  readonly colours: ClubColours;
  readonly socksColour: string;
  readonly quantity: number;
  readonly form: FormValues;
}

export interface ConfiguratorAddress {
  readonly sportId: string;
  readonly part: KitPartId;
  readonly market?: string;
  readonly saved?: Readonly<{ projectId: string; version: number }> | null;
  /** The kit as it stands, so a reload and the page the Save action returns to open the same kit. */
  readonly kit?: KitState;
}

/** The kit of one part, in the shape the address writes. */
export const kitStateOf = (kit: TeamwearKit, part: KitPartId): KitState | undefined => {
  const choice = kit.parts[part];
  if (!choice) return undefined;
  return { wearer: kit.wearer, colours: kit.colours, socksColour: kit.socksColour, quantity: choice.quantity, form: choice.form };
};

/** The configurator's own address: the sport, the part, the market, the saved design and the kit. */
export function configuratorHref(state: ConfiguratorAddress): string {
  const params = new URLSearchParams();
  params.set(PARAMS.sport, state.sportId);
  params.set(PARAMS.part, state.part);
  if (state.market) params.set(PARAMS.market, state.market);
  if (state.saved) {
    params.set(PARAMS.project, state.saved.projectId);
    params.set(PARAMS.version, String(state.saved.version));
  }
  const kit = state.kit;
  if (kit) {
    params.set(PARAMS.wearer, kit.wearer);
    params.set(PARAMS.main, kit.colours.main);
    params.set(PARAMS.second, kit.colours.second);
    if (kit.colours.third !== null) params.set(PARAMS.third, kit.colours.third);
    params.set(PARAMS.socks, kit.socksColour);
    params.set(PARAMS.quantity, String(kit.quantity));
    const written = writeForm(kit.form);
    for (const entry of written.opt) params.append(PARAMS.option, entry);
    for (const entry of written.par) params.append(PARAMS.parameter, entry);
  }
  return `/teamwear?${params.toString()}`;
}

/**
 * Where "Design in Studio" goes: the saved design in the editor, on the 3D canvas, with the Form
 * toolbar open and the configurator's own option codes and parameters in the address.
 */
export const studioHref = (projectId: string, choice: PartChoice): string =>
  `/studio/${projectId}${withEditorState("", { segment: "form", view: "3d", beside: null, size: null, form: choice.form })}`;

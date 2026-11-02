/**
 * What an import found, as rows a person says yes or no to **one at a time**.
 *
 * An import is not an all-or-nothing switch. A brand may want its favicon and two of its colours
 * and none of its photos, and the only way to offer that honestly is a row per thing with its own
 * two buttons. Every row starts `pending`: an import that is never looked at changes nothing.
 */

import { FONT_ROLE_LABELS } from "../words";
import { fontDetail } from "./fonts";
import { pictureDetail } from "./pictures";
import type { ImportItem, ImportedColour, ImportedFont, ImportedStyle, ItemKind, PictureFacts } from "./types";
import { ITEM_KIND_LABELS } from "./words";

/** The id of one row. Stable across two imports of the same site, so a decision can be remembered. */
export const itemId = (kind: ItemKind, of: string): string => `${kind}:${of}`;

/** What the page called a picture, or the file's own name when it said nothing. */
export const pictureLabel = (facts: PictureFacts): string => {
  const said = facts.alt?.trim();
  if (said !== undefined && said !== "") return said.slice(0, 80);
  const name = decodeURIComponent(facts.url.split("/").pop() ?? "").split("?")[0] ?? "";
  return name === "" ? ITEM_KIND_LABELS.logo : name.slice(0, 80);
};

const logoRow = (facts: PictureFacts): ImportItem => ({
  id: itemId("logo", facts.url),
  kind: "logo",
  label: pictureLabel(facts),
  detail: pictureDetail(facts),
  decision: "pending",
  notes: [],
});

const graphicRow = (facts: PictureFacts): ImportItem => ({ ...logoRow(facts), id: itemId("graphic", facts.url), kind: "graphic" });

const colourRow = (colour: ImportedColour): ImportItem => ({
  id: itemId("colour", colour.hex),
  kind: "colour",
  label: colour.hex,
  detail: colour.from,
  decision: "pending",
  notes: colour.notes,
});

const fontRow = (font: ImportedFont): ImportItem => ({
  id: itemId("font", font.role),
  kind: "font",
  label: FONT_ROLE_LABELS[font.role],
  detail: fontDetail(font),
  decision: "pending",
  notes: font.notes,
});

const styleRow = (style: ImportedStyle): ImportItem => ({
  id: itemId("style", "all"),
  kind: "style",
  label: "Setting, Art direction and Rules & boundaries",
  detail: `${Object.values(style).join(" ").trim().split(/\s+/).length} words, written from your own pictures`,
  decision: "pending",
  notes: [],
});

type Found = Readonly<{
  logos: readonly PictureFacts[];
  graphics: readonly PictureFacts[];
  colours: readonly ImportedColour[];
  fonts: readonly ImportedFont[];
  style: ImportedStyle | null;
}>;

/** Every row of one import, in the order the brand page's tabs run. */
export const itemsOf = (found: Found): readonly ImportItem[] => [
  ...found.logos.map(logoRow),
  ...found.colours.map(colourRow),
  ...found.fonts.map(fontRow),
  ...found.graphics.map(graphicRow),
  ...(found.style === null ? [] : [styleRow(found.style)]),
];

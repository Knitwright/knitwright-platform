import type { AssetProvenance, DrawnAsset } from "@/lib/launch";
import { GENERATED_IS_NEVER_ARTWORK, fillSlot } from "./assets";
import { MARKETING_RULE } from "./rules";
import { isMarketingFormat, type ColourRole, type MarketingFormat, type MarketingSlot } from "./templates/types";
import { COLOUR_ROLES } from "./templates/types";
import { COLOUR_SPACES, FILE_FORMATS, type ColourSpace, type FileFormat } from "./export/targets";

/**
 * A MARKETING BOARD'S OWN SETTINGS (plan v5 L4, decision 0094).
 *
 * The panel contract gives a panel eighteen requests and no writes, and the one that carries a
 * board's own state is `setBoardSettings(boardId, settings)` -- "so Regenerate reruns it unchanged"
 * (`lib/launch/panels.ts`). So everything a marketing board holds is in its settings: which layout
 * it is, what is in each slot, which colours its roles resolve to, what is hidden or locked, and
 * what the export panel was last set to.
 *
 * Two rules shape this file:
 *
 *   * **A reader never throws.** Settings come back as `Record<string, unknown>` from the shell,
 *     which read them from a row. Anything unexpected is read as "not set", so a board saved by an
 *     older version of this panel opens instead of breaking.
 *   * **A writer returns the whole settings object**, because that is what the command takes, and
 *     it goes through `fillSlot` first, so a panel cannot save words longer than the field or a
 *     picture a model made.
 *
 * No zod here: a panel imports this file, and zod in a client module ships zod to the browser
 * (`tests/architecture/client-weight.test.ts`).
 */

export interface LayerState {
  readonly slotId: string;
  readonly hidden: boolean;
  readonly locked: boolean;
  /** 0 to 100, as the inspector's "Layer opacity" shows it. */
  readonly opacity: number;
}

export interface ExportChoice {
  readonly targetKey: string | null;
  readonly dpi: number;
  readonly format: FileFormat;
  readonly colourSpace: ColourSpace;
  readonly removeBackground: boolean;
}

export interface MarketingBoardSettings {
  readonly templateSlug: string | null;
  readonly layoutKey: string | null;
  readonly format: MarketingFormat | null;
  /** The words in each text or QR slot, by slot id. */
  readonly words: Readonly<Record<string, string>>;
  /** The file id of the picture in each picture slot. A file the platform drew, never a generated one. */
  readonly pictures: Readonly<Record<string, string>>;
  /** What each colour role resolves to on this board. */
  readonly colours: Readonly<Partial<Record<ColourRole, string>>>;
  /** The repeat print filling a shape slot, by slot id (the Pattern fills panel). */
  readonly fills: Readonly<Record<string, string>>;
  readonly layers: readonly LayerState[];
  readonly export: ExportChoice;
}

export const DEFAULT_EXPORT: ExportChoice = { targetKey: null, dpi: 72, format: "png", colourSpace: "rgb", removeBackground: false };

export const EMPTY_SETTINGS: MarketingBoardSettings = {
  templateSlug: null,
  layoutKey: null,
  format: null,
  words: {},
  pictures: {},
  colours: {},
  fills: {},
  layers: [],
  export: DEFAULT_EXPORT,
};

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const textMap = (value: unknown): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(asRecord(value))) if (typeof entry === "string") out[key] = entry;
  return out;
};

const colourMap = (value: unknown): Readonly<Partial<Record<ColourRole, string>>> => {
  const out: Partial<Record<ColourRole, string>> = {};
  for (const role of COLOUR_ROLES) {
    const entry = asRecord(value)[role];
    if (typeof entry === "string") out[role] = entry;
  }
  return out;
};

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

const layerOf = (value: unknown): LayerState | null => {
  const row = asRecord(value);
  const slotId = text(row.slotId);
  if (slotId === null) return null;
  const opacity = typeof row.opacity === "number" && row.opacity >= 0 && row.opacity <= 100 ? Math.round(row.opacity) : 100;
  return { slotId, hidden: row.hidden === true, locked: row.locked === true, opacity };
};

const exportOf = (value: unknown): ExportChoice => {
  const row = asRecord(value);
  const format = FILE_FORMATS.find((one) => one === row.format) ?? DEFAULT_EXPORT.format;
  const space = COLOUR_SPACES.find((one) => one === row.colourSpace) ?? DEFAULT_EXPORT.colourSpace;
  const dpi = typeof row.dpi === "number" && row.dpi > 0 && row.dpi <= 1200 ? Math.round(row.dpi) : DEFAULT_EXPORT.dpi;
  return { targetKey: text(row.targetKey), dpi, format, colourSpace: space, removeBackground: row.removeBackground === true };
};

/** A board's settings, read as they come. Anything unexpected is read as not set. */
export function marketingSettings(value: unknown): MarketingBoardSettings {
  const row = asRecord(value);
  const format = text(row.format);
  return {
    templateSlug: text(row.templateSlug),
    layoutKey: text(row.layoutKey),
    format: format !== null && isMarketingFormat(format) ? format : null,
    words: textMap(row.words),
    pictures: textMap(row.pictures),
    colours: colourMap(row.colours),
    fills: textMap(row.fills),
    layers: Array.isArray(row.layers) ? row.layers.flatMap((one) => { const layer = layerOf(one); return layer ? [layer] : []; }) : [],
    export: exportOf(row.export),
  };
}

/** The settings as the shell stores them: a plain record, which is what `setBoardSettings` takes. */
export const asSettings = (settings: MarketingBoardSettings): Readonly<Record<string, unknown>> => ({ ...settings });

export type SettingsVerdict =
  | Readonly<{ ok: true; settings: MarketingBoardSettings }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

const refuse = (reason: string): SettingsVerdict => ({ ok: false, reason, ruleId: MARKETING_RULE });

/** The layout a board takes on, with everything that was in the old one cleared. */
export function withTemplate(settings: MarketingBoardSettings, template: Readonly<{ slug: string; layoutKey: string; format: MarketingFormat }>): MarketingBoardSettings {
  return { ...EMPTY_SETTINGS, export: settings.export, templateSlug: template.slug, layoutKey: template.layoutKey, format: template.format };
}

/** Words in one text slot, held to the field's own limit by `fillSlot`. */
export function withWords(settings: MarketingBoardSettings, slot: MarketingSlot, words: string): SettingsVerdict {
  const verdict = fillSlot(slot, { kind: "words", text: words });
  if (!verdict.ok) return refuse(verdict.reason);
  return { ok: true, settings: { ...settings, words: { ...settings.words, [slot.id]: words } } };
}

/** A picture a panel is offering, which may have come from anywhere, so its provenance is read first. */
export interface OfferedPicture {
  readonly fileId: string;
  readonly contentType: string;
  readonly provenance: AssetProvenance;
}

/**
 * The picture in one slot. A picture that came out of a model is refused here, before it is typed
 * as a `DrawnAsset` at all: that is the narrowing the garment lock is made of, and `fillSlot`
 * refuses it again behind this.
 */
export function withPicture(settings: MarketingBoardSettings, slot: MarketingSlot, picture: OfferedPicture): SettingsVerdict {
  if (picture.provenance === "generated") return refuse(GENERATED_IS_NEVER_ARTWORK);
  const asset: DrawnAsset = { role: "panel_layer", provenance: picture.provenance, file: { fileId: picture.fileId, contentType: picture.contentType } };
  const verdict = fillSlot(slot, { kind: "picture", asset });
  if (!verdict.ok) return refuse(verdict.reason);
  return { ok: true, settings: { ...settings, pictures: { ...settings.pictures, [slot.id]: picture.fileId } } };
}

/** What one colour role resolves to on this board. One click of a brand palette sets several. */
export const withColours = (settings: MarketingBoardSettings, colours: Readonly<Partial<Record<ColourRole, string>>>): MarketingBoardSettings => ({
  ...settings,
  colours: { ...settings.colours, ...colours },
});

/** The repeat print filling one shape slot. */
export const withFill = (settings: MarketingBoardSettings, slotId: string, fillId: string): MarketingBoardSettings => ({
  ...settings,
  fills: { ...settings.fills, [slotId]: fillId },
});

/** What the export panel was last set to, so opening it again shows the same choices. */
export const withExport = (settings: MarketingBoardSettings, choice: Partial<ExportChoice>): MarketingBoardSettings => ({
  ...settings,
  export: { ...settings.export, ...choice },
});

/** Everything a slot holds, taken out again. The slot itself is untouched. */
export function cleared(settings: MarketingBoardSettings, slotId: string): MarketingBoardSettings {
  const words = { ...settings.words };
  const pictures = { ...settings.pictures };
  const fills = { ...settings.fills };
  delete words[slotId];
  delete pictures[slotId];
  delete fills[slotId];
  return { ...settings, words, pictures, fills };
}

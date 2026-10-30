import {
  addLayer,
  BLANK_DRAFT,
  changeLayer,
  clampToTile,
  crossingBounds,
  newLayer,
  parseTileInput,
  periodSentence,
  removeLayer,
  reorderLayer,
  repeatFindings,
  repeatPreview,
  setBackground,
  setTileSide,
  tileRangeSentence,
  tileText,
  type DrawnShape,
  type RepeatDraft,
  type RepeatFinding,
  type RepeatLayer,
  type TileUnit,
} from "@/lib/repeat";
import type { UploadedArtwork } from "@/lib/artwork-intake/client";

/**
 * What the repeat maker shows, worked out from the draft it holds (plan v5 Y8, decision 0081). The
 * rules all live in `lib/repeat`; this module only arranges them for the panel, so the panel itself
 * holds markup and wiring and no rule of its own.
 */

/** The area the preview lays the repeat across: four tiles each way, so every style is visible. */
export const PREVIEW_TILES = 4;

export interface RepeatView {
  readonly draft: RepeatDraft;
  readonly findings: readonly RepeatFinding[];
  readonly blocked: boolean;
  readonly crossing: readonly string[];
  readonly preview: ReturnType<typeof repeatPreview>;
  readonly widthText: string;
  readonly heightText: string;
  readonly rangeSentence: string;
  readonly periodSentence: string;
}

export function repeatView(draft: RepeatDraft): RepeatView {
  const findings = repeatFindings(draft);
  const area = { widthTenths: draft.tile.widthTenths * PREVIEW_TILES, heightTenths: draft.tile.heightTenths * PREVIEW_TILES };
  return {
    draft,
    findings,
    blocked: findings.some((entry) => entry.severity === "blocker"),
    crossing: crossingBounds(draft),
    preview: repeatPreview(draft, area),
    widthText: tileText(draft.tile.widthTenths, draft.unit),
    heightText: tileText(draft.tile.heightTenths, draft.unit),
    rangeSentence: tileRangeSentence(draft.unit),
    periodSentence: periodSentence(draft, (tenths) => `${tileText(tenths, draft.unit)} ${draft.unit}`),
  };
}

/** A new repeat. Named for the design it was made from, so it is findable in the library. */
export const startDraft = (designName: string): RepeatDraft => ({ ...BLANK_DRAFT, name: `${designName} fill` });

/**
 * The unit the person types in. The tile itself does not change: 10 cm stays 10 cm and reads
 * 3.94 in, so switching units can never quietly resize a tile.
 */
export const withUnit = (draft: RepeatDraft, unit: TileUnit): RepeatDraft => ({ ...draft, unit });

export type SideRead = Readonly<{ ok: true; draft: RepeatDraft }> | Readonly<{ ok: false; reason: string }>;

/** One side of the tile, from what was typed. Every layer still inside the tile stays inside it. */
export function typeSide(draft: RepeatDraft, side: "width" | "height", text: string): SideRead {
  const read = parseTileInput(text, draft.unit);
  if (!read.ok) return { ok: false, reason: read.reason };
  const resized = setTileSide(draft, side, read.tenths);
  const layers = resized.layers.map((layer) => (crossingBounds(draft).includes(layer.id) ? layer : clampToTile(layer, resized.tile)));
  return { ok: true, draft: { ...resized, layers } };
}

/** A picture the person uploaded, as a layer. The upload itself went through moderation first. */
export const layerFromUpload = (draft: RepeatDraft, artwork: UploadedArtwork): RepeatLayer =>
  newLayer(draft, {
    id: artwork.id,
    label: artwork.label,
    artworkId: artwork.id,
    sourcePx: { width: artwork.widthPx, height: artwork.heightPx },
  });

/** A shape the person drew, as a layer. Each gets an id of its own so two of a kind can both be on. */
export const layerFromShape = (draft: RepeatDraft, shape: DrawnShape, colour: string, count: number): RepeatLayer =>
  newLayer(draft, { id: `${shape}-${count}`, label: `${shape[0]?.toUpperCase()}${shape.slice(1)} ${count}`, shape, colour });

export { addLayer, changeLayer, clampToTile, removeLayer, reorderLayer, setBackground };

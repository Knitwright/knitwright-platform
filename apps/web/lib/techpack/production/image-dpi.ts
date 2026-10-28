import type { ArtworkStack, ImageFillLayer, GraphicLayer, Layer } from "@/lib/artwork-stack";
import { DEFAULT_MIN_DPI } from "@/lib/artwork-intake/settings";
import { dpiWarning, effectiveDpi } from "@/lib/artwork-intake/dpi";
import { DEFAULT_LABEL, type GradedPattern } from "@/lib/production/contract";
import { createPieceMapper } from "@/lib/print/layout/mapper";
import { formatCm } from "@/lib/garment";
import { TBC, textCell, type Cell, type LengthValue, type NumberValue } from "../cell";
import type { LowDpiAcceptance, MinDpiSetting, PlacedAsset, ProductionInput } from "./input";
import { ASSUMED_DPI } from "./repeat-spec";
import type { ImageRow } from "./types-art";

export const DEFAULT_MIN_DPI_SETTING: MinDpiSetting = { value: DEFAULT_MIN_DPI, source: "knitwright-default" };

/** The lowest resolution the print house accepts, else Knitwright's default of 150 (open owner input P14). */
export const minDpiOf = (input: Pick<ProductionInput, "minDpi">): MinDpiSetting => input.minDpi ?? DEFAULT_MIN_DPI_SETTING;

export function imageNote(min: MinDpiSetting, scale: number): string {
  const source = min.source === "print-house" ? "From your print house." : `${DEFAULT_LABEL}.`;
  const enlarged = Math.abs(scale - 1) > 0.00005 ? ` Pictures are measured as printed, enlarged by ${scale.toFixed(4)} for shrink.` : "";
  return `The smallest resolution that counts as good is ${min.value} dpi. ${source}${enlarged} A vector has no resolution to meet.`;
}

interface ImageContext {
  readonly assets: readonly PlacedAsset[];
  readonly minDpi: MinDpiSetting;
  /** How much larger artwork is printed than drawn, across. 1 when the fabric has no shrink test. */
  readonly scale: number;
  readonly acceptances: readonly LowDpiAcceptance[];
  readonly pattern: GradedPattern | null | undefined;
}

const mm = (value: number): LengthValue => ({ status: "set", value: formatCm(Math.round(value * 10)), tenthsMm: Math.round(value * 10), provenance: "derived" });
const dpiCell = (dpi: number): NumberValue => ({ status: "set", value: `${Math.round(dpi)} dpi`, provenance: "derived", number: Math.round(dpi), unit: "dots per inch" });

/** The width a full-panel picture prints at: the piece it covers on the largest size, filled (cover) or fitted (contain). */
function panelWidthMm(layer: ImageFillLayer, asset: PlacedAsset, pattern: GradedPattern | null | undefined): number | null {
  const size = pattern?.sizes.at(-1);
  if (!pattern || size === undefined) return null;
  const instance = createPieceMapper(pattern).placed(size).find((entry) => layer.views.includes(entry.instance.view))?.instance;
  if (!instance) return null;
  const xs = instance.opened.map(([x]) => x);
  const ys = instance.opened.map(([, y]) => y);
  const along = Math.max(...xs) - Math.min(...xs);
  const across = Math.max(...ys) - Math.min(...ys);
  const ratio = asset.widthPx / asset.heightPx;
  const fillsWidth = layer.fit === "cover" ? Math.max(across, along * ratio) : Math.min(across, along * ratio);
  return fillsWidth;
}

function printedWidthOf(layer: GraphicLayer | ImageFillLayer, asset: PlacedAsset | undefined, context: ImageContext): number | null {
  if (layer.kind === "graphic") return layer.widthMm * context.scale;
  if (asset === undefined) return null;
  if (layer.mode === "panel") {
    const width = panelWidthMm(layer, asset, context.pattern);
    return width === null ? null : width * context.scale;
  }
  return ((asset.widthPx / (asset.dpiMeta ?? ASSUMED_DPI)) * 25.4) * layer.scale * context.scale;
}

const acceptedCell = (layerId: string, acceptances: readonly LowDpiAcceptance[]): Cell => {
  const found = acceptances.find((entry) => entry.layerId === layerId);
  return found === undefined ? TBC : textCell(`${found.name} on ${found.date}`, "user-edited");
};

function rowFor(layer: GraphicLayer | ImageFillLayer, context: ImageContext): ImageRow {
  const assetId = layer.kind === "graphic" ? (layer.source.kind === "asset" ? layer.source.assetId : null) : layer.assetId;
  const asset = context.assets.find((entry) => entry.id === assetId);
  const width = printedWidthOf(layer, asset, context);
  const head = {
    layerId: layer.id,
    layer: layer.name ?? layer.id,
    picture: asset?.label ?? layer.name ?? layer.id,
    pixels: asset === undefined ? "Not on record" : `${asset.widthPx} x ${asset.heightPx} px`,
    printedWidth: width === null ? TBC : mm(width),
    acceptedBy: acceptedCell(layer.id, context.acceptances),
  };
  if (asset?.kind === "vector") return { ...head, dpi: null, result: "vector", sentence: "A vector picture has no resolution to meet." };
  if (asset === undefined) {
    return { ...head, dpi: null, result: "unknown", sentence: "The size of this picture is not on record, so its resolution is not known. Upload it again through the artwork upload." };
  }
  if (width === null) {
    return { ...head, dpi: null, result: "unknown", sentence: "How large this picture prints is not known until the pattern is in, so its resolution is not known." };
  }
  const dpi = effectiveDpi(asset, width);
  const warning = dpiWarning(asset, width, context.minDpi.value);
  return { ...head, dpi: dpiCell(dpi), result: warning === null ? "meets" : "below", sentence: warning ?? `This picture prints at about ${Math.round(dpi)} dpi, which meets the ${context.minDpi.value} dpi minimum.` };
}

const isPicture = (layer: Layer): layer is GraphicLayer | ImageFillLayer => layer.kind === "graphic" || layer.kind === "image-fill";

/** Every picture placed or tiled in the stack, with the resolution it prints at, measured as printed. */
export function imageRows(stack: ArtworkStack, context: ImageContext): ImageRow[] {
  return stack.layers.filter(isPicture).map((layer) => rowFor(layer, context));
}

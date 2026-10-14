import { compose, type Affine } from "@/lib/print/geometry/affine";
import { pageSizeMm, type FillItem, type ImageItem, type PieceScene, type Ring, type SceneItem, type StrokeItem } from "@/lib/print/scene";
import { alpha, colourChannels, fine, mm, pageOrigin } from "../format";

export const POINTS_PER_MM = 72 / 25.4;
const PDF_BLEND: Readonly<Record<string, string>> = { multiply: "Multiply", screen: "Screen", overlay: "Overlay" };

/** What the page's drawing refers to by name. */
export interface PageResources {
  /** ExtGState dictionaries, named GS0, GS1... */
  readonly graphicsStates: readonly string[];
  /** Pictures named Im0, Im1... */
  readonly images: readonly ImageItem[];
}

const colour = (value: string): string => colourChannels(value).map((v) => v.toFixed(4)).join(" ");

function ringPath(ring: Ring): string {
  const ops = ring.map(([x, y], index) => `${mm(x)} ${mm(y)} ${index === 0 ? "m" : "l"}`);
  return `${ops.join(" ")} h`;
}

const ringsPath = (rings: readonly Ring[]): string => rings.filter((ring) => ring.length > 0).map(ringPath).join(" ");

/** Names for what the page uses. Its lists grow as items are drawn, then are handed out read-only. */
function createRegistry(): {
  readonly stateFor: (opacity: number, blend: string) => string;
  readonly imageName: (item: ImageItem) => string;
  readonly resources: () => PageResources;
} {
  const states: string[] = [];
  const images: ImageItem[] = [];
  const stateKeys = new Map<string, number>();
  const imageKeys = new Map<string, number>();
  return {
    stateFor: (opacity, blend) => {
      const mode = PDF_BLEND[blend];
      if (opacity >= 1 && !mode) return "";
      const entries = `/Type /ExtGState /ca ${alpha(opacity)} /CA ${alpha(opacity)} /BM /${mode ?? "Normal"}`;
      if (!stateKeys.has(entries)) {
        stateKeys.set(entries, states.length);
        states.push(`<< ${entries} >>`);
      }
      return `/GS${stateKeys.get(entries)} gs `;
    },
    imageName: (item) => {
      if (!imageKeys.has(item.imageId)) {
        imageKeys.set(item.imageId, images.length);
        images.push(item);
      }
      return `/Im${imageKeys.get(item.imageId)}`;
    },
    resources: () => ({ graphicsStates: states, images }),
  };
}

const guideLines = (scene: PieceScene): string[] => [
  "/OC /OC0 BDC q 1.0000 0.0000 1.0000 RG 0.25 w",
  `${ringPath(scene.cut)} S`,
  "0.0000 1.0000 1.0000 RG [1.5 1] 0 d",
  `${ringPath(scene.bleed)} S Q EMC`,
];

/** The matrix that takes page-plane millimetres to points, with the page's corner at the origin. */
function toPointsMatrix(scene: PieceScene): string {
  const size = pageSizeMm(scene);
  const origin = pageOrigin(scene);
  const k = POINTS_PER_MM;
  return [k, 0, 0, k, -origin.x * k, -(origin.y - size.height) * k].map(fine).join(" ");
}

/** Draws the page: art clipped to the bleed, then the guides in their layer, then the margin. */
export function buildPageContent(scene: PieceScene, items: readonly SceneItem[]): { readonly stream: string; readonly resources: PageResources } {
  const registry = createRegistry();
  const state = registry.stateFor;

  const fill = (item: FillItem): string => `q ${state(item.opacity, item.blend)}${colour(item.colour)} rg ${ringsPath(item.rings)} f* Q`;

  const stroke = (item: StrokeItem): string => {
    const path = ringPath(item.points);
    const drawn = item.closed ? path : path.replace(/ h$/, "");
    return `q ${state(item.opacity, item.blend)}${colour(item.colour)} RG ${mm(item.widthMm)} w 1 J 1 j ${drawn} S Q`;
  };

  const picture = (item: ImageItem): string => {
    const clip = item.clip.length > 0 ? `${ringsPath(item.clip)} W* n ` : "";
    const unitToPixels: Affine = [item.widthPx, 0, 0, -item.heightPx, 0, item.heightPx];
    const matrix = compose(item.matrix, unitToPixels).map(fine).join(" ");
    return `q ${state(item.opacity, item.blend)}${clip}${matrix} cm ${registry.imageName(item)} Do Q`;
  };

  const draw = (item: SceneItem): string => (item.kind === "fill" ? fill(item) : item.kind === "stroke" ? stroke(item) : picture(item));
  const lines = [`${toPointsMatrix(scene)} cm`, `q ${ringPath(scene.bleed)} W* n`, ...items.map(draw), "Q", ...guideLines(scene), ...scene.margin.map(fill)];
  return { stream: `${lines.join("\n")}\n`, resources: registry.resources() };
}

import type { Affine } from "@/lib/print/geometry/affine";
import type { PieceScene, Ring } from "@/lib/print/scene";

const COLOUR = /^#[0-9a-f]{6}$/;

function fixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) throw new RangeError("A number in a print file must be finite.");
  const text = value.toFixed(digits);
  return Number(text) === 0 ? (0).toFixed(digits) : text;
}

/** A length in millimetres: fixed 0.01 mm precision. */
export const mm = (value: number): string => fixed(value, 2);

/** A matrix scale or shear, which needs more places than a length. */
export const fine = (value: number): string => fixed(value, 6);

/** An opacity from 0 to 1. */
export const alpha = (value: number): string => fixed(Math.min(1, Math.max(0, value)), 3);

/** Only a `#rrggbb` colour is ever written into a file. */
export function checkedColour(colour: string): string {
  if (!COLOUR.test(colour)) throw new RangeError("A print colour must look like #rrggbb.");
  return colour;
}

/** The colour as red, green and blue, each 0 to 1. */
export function colourChannels(colour: string): readonly [number, number, number] {
  const hex = checkedColour(colour);
  const channel = (start: number): number => Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  return [channel(1), channel(3), channel(5)];
}

/** Text for an element body: markup characters escaped, characters XML cannot hold dropped. */
export function escapeText(text: string): string {
  return text
    .replace(/[^\t\n\r -퟿-�]/gu, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface PageOrigin {
  readonly x: number;
  readonly y: number;
}

/** The scene point that sits at the page's top left corner. */
export const pageOrigin = (scene: PieceScene): PageOrigin => ({ x: scene.cutBox.minX - scene.bleedMm, y: scene.cutBox.maxY + scene.bleedMm });

/** Page plane to page coordinates (y down, from the top left). */
export const toPageMatrix = (scene: PieceScene): Affine => {
  const origin = pageOrigin(scene);
  return [1, 0, 0, -1, -origin.x, origin.y];
};

/** The piece's name and size, for the file's title. */
export const pieceTitle = (scene: PieceScene): string => `${scene.pieceName} (${scene.size})`;

/** "M x y L x y Z" for a ring already in page coordinates. */
export function svgRing(ring: Ring, scene: PieceScene): string {
  const origin = pageOrigin(scene);
  const points = ring.map(([x, y], index) => `${index === 0 ? "M" : "L"}${mm(x - origin.x)} ${mm(origin.y - y)}`);
  return `${points.join(" ")} Z`;
}

export const svgRings = (rings: readonly Ring[], scene: PieceScene): string =>
  rings.filter((ring) => ring.length > 0).map((ring) => svgRing(ring, scene)).join(" ");

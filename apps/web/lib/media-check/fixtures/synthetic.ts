import sharp from "sharp";
import type { PanelRegion, ProtectedRegion } from "../types";

/**
 * Synthetic jersey pictures, drawn from one 1000 by 1000 SVG at any size. Nothing here is a real render or a
 * real generation; the variants stand in for the ways a generation goes wrong.
 */

interface Variant {
  readonly base?: string;
  readonly sleeve?: string;
  /** How far the middle stripe moves, in canvas units of 1000. */
  readonly stripeShift?: number;
  /** An SVG transform applied to the crest around its centre. */
  readonly crestTransform?: string;
  readonly hideCrest?: boolean;
  /** The whole garment moves by this much, in canvas units. */
  readonly shiftX?: number;
  /** Background colour; omitted means transparent (a reference). */
  readonly background?: string;
  /** Strength of a soft light falling off from one corner (0 to 0.3). */
  readonly relight?: number;
}

const BASE = "#14213d";
const SLEEVE = "#c1121f";
const STRIPE = "#8ecae6";

export function jerseySvg(v: Variant = {}): string {
  const [base, sleeve] = [v.base ?? BASE, v.sleeve ?? SLEEVE];
  const crest = v.hideCrest
    ? ""
    : `<g transform="translate(415 330) ${v.crestTransform ?? ""} translate(-415 -330)"><path d="M360 260 H470 V340 Q415 400 360 340 Z" fill="#fca311"/><path d="M385 280 H405 V315 L430 280 H452 L422 320 L455 360 H432 L405 330 V360 H385 Z" fill="#ffffff"/></g>`;
  const light = v.relight ? `<defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${v.relight}"/><stop offset="1" stop-color="#000" stop-opacity="${v.relight}"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#l)"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
${v.background ? `<rect width="1000" height="1000" fill="${v.background}"/>` : ""}
<g transform="translate(${v.shiftX ?? 0} 0)">
<polygon points="220,150 40,330 130,420 260,300" fill="${sleeve}"/><polygon points="780,150 960,330 870,420 740,300" fill="${sleeve}"/>
<rect x="220" y="150" width="560" height="800" rx="30" fill="${base}"/>
<rect x="300" y="150" width="40" height="800" fill="${STRIPE}"/><rect x="${480 + (v.stripeShift ?? 0)}" y="150" width="40" height="800" fill="${STRIPE}"/><rect x="660" y="150" width="40" height="800" fill="${STRIPE}"/>
${crest}
<rect x="260" y="520" width="480" height="70" fill="#f1faee"/><rect x="290" y="535" width="60" height="40" fill="#1d3557"/><rect x="380" y="535" width="30" height="40" fill="#e63946"/><rect x="450" y="535" width="90" height="15" fill="#1d3557"/><rect x="450" y="560" width="50" height="15" fill="#1d3557"/><rect x="600" y="535" width="100" height="40" fill="#457b9d"/>
<path d="M440 700 H550 V730 L500 860 H468 L515 730 H440 Z" fill="#f1faee"/>
</g>
${light}
</svg>`;
}

export const toPng = (svg: string, size: number): Promise<Uint8Array> => sharp(Buffer.from(svg), { density: 72 }).resize(size, size).png().toBuffer();

/** The deterministic render: the clean jersey on a transparent canvas. */
export const referencePng = (size = 640): Promise<Uint8Array> => toPng(jerseySvg(), size);

/** The plain grey a generated picture sits on. The checker tells garment from background by colour, so a variant that paints the garment this colour has no garment to find. */
export const GENERATED_BACKGROUND = "#dcdcdc";

/** A generated picture: the jersey (clean or changed) on a plain grey background. */
export const generatedPng = (variant: Variant = {}, size = 640): Promise<Uint8Array> => toPng(jerseySvg({ background: GENERATED_BACKGROUND, ...variant }), size);

export const panelsFor = (size: number): PanelRegion[] => {
  const k = size / 1000;
  return [
    { id: "body", x: 220 * k, y: 150 * k, width: 560 * k, height: 800 * k },
    { id: "left-sleeve", x: 40 * k, y: 150 * k, width: 220 * k, height: 280 * k },
    { id: "right-sleeve", x: 740 * k, y: 150 * k, width: 220 * k, height: 280 * k },
  ];
};

export const marksFor = (size: number): ProtectedRegion[] => {
  const k = size / 1000;
  return [
    { id: "crest", kind: "crest", x: 350 * k, y: 250 * k, width: 130 * k, height: 160 * k },
    { id: "sponsor", kind: "sponsor", x: 260 * k, y: 520 * k, width: 480 * k, height: 70 * k },
    { id: "number", kind: "number", x: 430 * k, y: 690 * k, width: 130 * k, height: 180 * k },
  ];
};

import type { Lab } from "@/lib/design-import/colours";

const RAD = Math.PI / 180;
const POW25_7 = 25 ** 7;

const hueOf = (b: number, a: number): number => {
  if (a === 0 && b === 0) return 0;
  const h = Math.atan2(b, a) / RAD;
  return h < 0 ? h + 360 : h;
};

/** The difference in hue between two colours, in degrees, for the pair whose chroma is not zero. */
function hueDifference(c1: number, c2: number, h1: number, h2: number): number {
  if (c1 * c2 === 0) return 0;
  const d = h2 - h1;
  if (Math.abs(d) <= 180) return d;
  return d > 180 ? d - 360 : d + 360;
}

function meanHue(c1: number, c2: number, h1: number, h2: number): number {
  if (c1 * c2 === 0) return h1 + h2;
  if (Math.abs(h1 - h2) <= 180) return (h1 + h2) / 2;
  return (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
}

/** CIEDE2000 colour difference between two Lab colours (Sharma, Wu and Dalal, 2005). Weights kL = kC = kH = 1. */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;
  const cMean0 = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cMean0 ** 7 / (cMean0 ** 7 + POW25_7)));
  const [a1p, a2p] = [(1 + g) * a1, (1 + g) * a2];
  const [c1, c2] = [Math.hypot(a1p, b1), Math.hypot(a2p, b2)];
  const [h1, h2] = [hueOf(b1, a1p), hueOf(b2, a2p)];
  const dL = l2 - l1;
  const dC = c2 - c1;
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((hueDifference(c1, c2, h1, h2) / 2) * RAD);
  const lMean = (l1 + l2) / 2;
  const cMean = (c1 + c2) / 2;
  const hMean = meanHue(c1, c2, h1, h2);
  const t = 1 - 0.17 * Math.cos((hMean - 30) * RAD) + 0.24 * Math.cos(2 * hMean * RAD) + 0.32 * Math.cos((3 * hMean + 6) * RAD) - 0.2 * Math.cos((4 * hMean - 63) * RAD);
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cMean;
  const sh = 1 + 0.015 * cMean * t;
  const rt = -2 * Math.sqrt(cMean ** 7 / (cMean ** 7 + POW25_7)) * Math.sin(60 * Math.exp(-(((hMean - 275) / 25) ** 2)) * RAD);
  const [x, y, z] = [dL / sl, dC / sc, dH / sh];
  return Math.sqrt(x * x + y * y + z * z + rt * y * z);
}

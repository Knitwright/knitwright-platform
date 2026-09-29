import type { GarmentSpec } from "@/lib/garment";
import type { TopsOptions } from "../../templates/options";
import { chosen } from "../drawing";

/** What the drawing needs to know about a hoodie or a track jacket, read from the design. */
export interface OuterwearOptions {
  readonly raglan: boolean;
  readonly hood: "none" | "single-layer" | "lined";
  readonly drawcord: boolean;
  readonly fullZip: boolean;
  readonly collar: "none" | "stand";
  readonly pockets: "none" | "kangaroo" | "side-seam" | "zip-side";
  readonly ribCuffs: boolean;
  readonly ribHem: boolean;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/** Reads the options of a design. A missing or unknown choice is read as the plain one. */
export function readOuterwearOptions(spec: Pick<GarmentSpec, "options">): OuterwearOptions {
  return {
    raglan: chosen(spec, "sleeve-type") === "raglan",
    hood: oneOf(chosen(spec, "hood"), ["none", "single-layer", "lined"] as const, "none"),
    drawcord: chosen(spec, "hood-drawcord") === "drawcord",
    fullZip: chosen(spec, "front-opening") === "full-zip",
    collar: chosen(spec, "collar") === "stand-collar" ? "stand" : "none",
    pockets: oneOf(chosen(spec, "pockets"), ["none", "kangaroo", "side-seam", "zip-side"] as const, "none"),
    ribCuffs: chosen(spec, "cuffs") === "rib-cuff",
    ribHem: chosen(spec, "hem-finish") === "rib-band",
  };
}

/** The same garment as the tops drawing code sees it: the body, sleeves and neck of a top. */
export const asTopsOptions = (options: OuterwearOptions): TopsOptions => ({
  raglan: options.raglan,
  neck: "round",
  collar: options.collar === "stand" ? "band-collar" : "none",
  placket: "none",
  longSleeve: true,
  hem: "straight",
  sidePanels: false,
  cuffs: options.ribCuffs,
});

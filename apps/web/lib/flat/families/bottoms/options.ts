import type { GarmentSpec } from "@/lib/garment";
import { chosen } from "../drawing";

/** What the drawing needs to know about a pair of bottoms, read from the design. */
export interface BottomsOptions {
  readonly leggings: boolean;
  readonly legLength: "short" | "cropped" | "full";
  readonly waistband: "elastic-drawcord" | "elastic" | "wide-band";
  readonly legFinish: "hem" | "rib-cuff" | "ankle-zip";
  readonly gusset: boolean;
  readonly stripe: boolean;
  readonly pockets: "none" | "side-seam" | "zip-side";
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/** Reads the options of a design. A missing or unknown choice is read as the plain one. */
export function readBottomsOptions(spec: Pick<GarmentSpec, "options" | "typeId">): BottomsOptions {
  return {
    leggings: spec.typeId === "leggings",
    legLength: oneOf(chosen(spec, "leg-length"), ["short", "cropped", "full"] as const, "full"),
    waistband: oneOf(chosen(spec, "waistband"), ["elastic-drawcord", "elastic", "wide-band"] as const, "elastic"),
    legFinish: oneOf(chosen(spec, "leg-finish"), ["hem", "rib-cuff", "ankle-zip"] as const, "hem"),
    gusset: chosen(spec, "gusset") === "crotch-gusset",
    stripe: chosen(spec, "side-stripe") === "contrast-stripe",
    pockets: oneOf(chosen(spec, "pockets"), ["none", "side-seam", "zip-side"] as const, "none"),
  };
}

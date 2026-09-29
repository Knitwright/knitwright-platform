import type { GarmentSpec } from "@/lib/garment";

/** What the drawing needs to know about a top, read from the options of the design. */
export interface TopsOptions {
  readonly raglan: boolean;
  readonly neck: "round" | "v";
  readonly collar: "none" | "polo-collar" | "band-collar";
  readonly placket: "none" | "buttons" | "zip";
  readonly longSleeve: boolean;
  readonly hem: "straight" | "curved" | "side-vent";
  readonly sidePanels: boolean;
  readonly cuffs: boolean;
}

const chosen = (spec: Pick<GarmentSpec, "options">, optionId: string): string | undefined =>
  Object.hasOwn(spec.options, optionId) ? spec.options[optionId]?.choiceId : undefined;

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/**
 * Reads the options of a design. A choice that is missing or not known is read as the
 * plain choice, so a damaged design still gets a drawing.
 */
export function readTopsOptions(spec: Pick<GarmentSpec, "options">): TopsOptions {
  return {
    raglan: chosen(spec, "sleeve-type") === "raglan",
    neck: chosen(spec, "neckline") === "v-neck" ? "v" : "round",
    collar: oneOf(chosen(spec, "collar"), ["none", "polo-collar", "band-collar"] as const, "none"),
    placket: oneOf(chosen(spec, "placket"), ["none", "buttons", "zip"] as const, "none"),
    longSleeve: chosen(spec, "sleeve-length") === "long",
    hem: oneOf(chosen(spec, "hem-shape"), ["straight", "curved", "side-vent"] as const, "straight"),
    sidePanels: chosen(spec, "side-panels") === "contrast-insert",
    cuffs: chosen(spec, "cuffs") === "rib-cuff",
  };
}

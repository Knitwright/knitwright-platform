import type { GarmentSpec } from "@/lib/garment";
import type { TopsOptions } from "../../templates/options";
import { chosen } from "../drawing";

/** What the drawing needs to know about a close-fitting garment, read from the design. */
export interface CloseFitOptions {
  readonly kind: "singlet" | "vest" | "sports-bra" | "compression-top";
  readonly sleeves: "sleeveless" | "short" | "long";
  readonly racerback: boolean;
  readonly edge: "bound" | "turned" | "elastic";
  readonly underband: boolean;
  readonly flatSeams: boolean;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

/** Reads the options of a design. A missing or unknown choice is read as the plain one. */
export function readCloseFitOptions(spec: Pick<GarmentSpec, "options" | "typeId">): CloseFitOptions {
  return {
    kind: oneOf(spec.typeId, ["singlet", "vest", "sports-bra", "compression-top"] as const, "singlet"),
    sleeves: oneOf(chosen(spec, "sleeves"), ["sleeveless", "short", "long"] as const, "sleeveless"),
    racerback: chosen(spec, "back-style") === "racerback",
    edge: oneOf(chosen(spec, "edge-finish"), ["bound", "turned", "elastic"] as const, "turned"),
    underband: ["exposed-elastic", "covered-elastic"].includes(chosen(spec, "underband") ?? ""),
    flatSeams: chosen(spec, "seam-type") === "flatlock",
  };
}

/** A garment with sleeves, as the tops drawing code sees it. */
export const asTopsOptions = (options: CloseFitOptions): TopsOptions => ({
  raglan: false,
  neck: "round",
  collar: "none",
  placket: "none",
  longSleeve: options.sleeves === "long",
  hem: "straight",
  sidePanels: false,
  cuffs: false,
});

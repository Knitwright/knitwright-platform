import { PLACE_DEFINITIONS, type GarmentSpec } from "@/lib/garment";
import type { RosterContext } from "./checks";

/** What a roster is checked against: the design's sizes, and whether it prints a name. */
export function rosterContextOf(spec: Pick<GarmentSpec, "sizing" | "namesAndNumbers">): RosterContext {
  const places = spec.namesAndNumbers?.places ?? [];
  return {
    run: spec.sizing?.sizes ?? [],
    hasNamePlace: places.some((entry) => PLACE_DEFINITIONS[entry.place].shows === "name"),
  };
}

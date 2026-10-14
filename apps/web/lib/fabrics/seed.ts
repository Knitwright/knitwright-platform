import type { FabricInput } from "./schemas";

/**
 * The three fabrics the benchmark tech pack names (docs/owner/reference/fashioninsta-2026-10-14/).
 * Every number is left empty: its "~140 gsm" and "50 %+ stretch" are its own guesses, not a test or a
 * supplier's sheet, so they are kept as notes in its words and no value is set.
 */
export const BENCHMARK_FABRICS: readonly FabricInput[] = Object.freeze([
  {
    name: "Recycled polyester interlock",
    composition: "100 % recycled polyester",
    construction: "Interlock",
    notes: "Main body fabric named by the benchmark, which says about 140 gsm. Not tested: add a fabric test for stretch and shrink.",
    supplier: {},
  },
  {
    name: "Polyester birdseye mesh",
    composition: "Polyester",
    construction: "Birdseye mesh",
    notes: "The benchmark's alternative to interlock for the main body. Not tested.",
    supplier: {},
  },
  {
    name: "Polyester 1x1 rib",
    composition: "Polyester",
    construction: "1x1 rib",
    notes: "Collar rib named by the benchmark, which says about 200 gsm and 50 % stretch or more. Not tested.",
    supplier: {},
  },
]);

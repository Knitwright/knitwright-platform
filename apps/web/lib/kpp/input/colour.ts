import { GAP_RULE, type KppColour, type KppColourSpec } from "../model";
import { chosenFabric, type KppRows } from "./model";

/**
 * The colour spec (docs/spec/04, `05_colour`). The roles, their screen colours and their Pantone TCX codes come
 * from the design object (X4); the fabric, the swatch reference and the colour difference the factory can hold come
 * from X6's `programme_fabrics`, `programme_fabric_colours` and `factory_capabilities`.
 *
 * **Owner decision 15 stands.** The Lab figures in the package are computed from the screen colour in sRGB under
 * D65 with the two-degree observer — the same maths as `lib/print/rules/colour` — and `05_colour` states that space
 * and observer, so the colour house knows what the numbers are in. `docs/spec/04`'s own example for `#0B1F4B`,
 * Lab [12.9, 4.1, -27.6], is not what that maths gives ([13, 10.7, -29.6]); the spec calls its numbers
 * illustrative, so it is recorded as unverified and our figure is kept. Until the colour house states its white
 * point, delta E <= 1.5 is defined against ours. Nothing here "fixes" our numbers to match the spec.
 */

/** The programme's own colour row for a screen colour of the chosen fabric, or undefined when it holds none. */
function programmeColour(rows: KppRows, hex: string) {
  const fabric = chosenFabric(rows);
  if (fabric === null) return undefined;
  return rows.fabricColours.find((colour) => colour.fabricCode === fabric.code && colour.hex.toUpperCase() === hex.toUpperCase());
}

/**
 * One colour role. The Pantone code is the design's own where the brand gave one, and otherwise the programme
 * row's for that fabric colour. The swatch reference is the fabric's: our programme keeps one reference per fabric
 * rather than one per colour, so it is carried only for a colour the fabric's programme actually holds, and
 * nothing is written for a colour it does not.
 */
const toColour = (rows: KppRows, role: Readonly<{ role: string; hex: string; pantone?: string }>): KppColour => {
  const known = programmeColour(rows, role.hex);
  return {
    role: role.role,
    hex: role.hex,
    pantoneTcx: role.pantone ?? known?.pantone ?? null,
    swatchId: known === undefined ? null : (chosenFabric(rows)?.swatchRef ?? null),
  };
};

/**
 * The colour spec of the design version. The tolerance is the factory's own agreed maximum; it is null when the
 * capability has none, and the gate then refuses rather than the package stating a number nobody agreed.
 */
export function colourSpec(rows: KppRows): KppColourSpec {
  const fabric = chosenFabric(rows);
  return {
    fabric: fabric === null ? null : fabric.code,
    tolerance: { metric: "dE_CMC_2_1", max: rows.capability?.colourDeltaMax ?? null },
    colours: rows.object.colourway.colours.map((colour) => toColour(rows, colour)),
    // Sublimation is printed to a strike-off before a run; a factory that does not need one says so in its rules.
    strikeOffRequired: fabric?.sublimatable === true,
    ruleId: rows.capability?.ruleId ?? fabric?.ruleId ?? GAP_RULE,
  };
}

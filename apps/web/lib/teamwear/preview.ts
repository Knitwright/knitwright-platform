import { applyAction, createSpec, panelsFor, type GarmentSpec, type SpecAction, type Wearer } from "@/lib/garment";
import { kitStylesFor, withKitStyle } from "@/lib/kit-styles/presets";
import { flatPreview, type FlatPreviewData } from "@/lib/projects/flat-preview";
import type { KitPart, PartChoice, TeamwearKit } from "./kit";
import { STAGE_NOT_DRAWN } from "./stage";

/**
 * What the stage draws. The configurator holds a kit, not a design; this turns one part of the kit
 * into a design in memory and draws it with the very code the editor and the tech pack use
 * (`lib/projects/flat-preview`), so the stage, the editor and every export show the same version
 * identically (spec F-S9).
 *
 * Nothing here fetches and nothing here stores. It runs on the server for the first picture and in
 * the browser for every change after it, which is why colours answer at once.
 */

/** Every colour in the colourway set to one swatch, for a part the kit styles do not cover (socks). */
const colourEverything = (spec: GarmentSpec, swatch: string): SpecAction => ({
  type: "update-colourway",
  colourway: {
    ...spec.colourways[0],
    colours: panelsFor(spec).map((panel) => ({ panelId: panel.id, colour: "", swatch, provenance: "user-edited" as const })),
  },
});

export type SpecOutcome = Readonly<{ ok: true; spec: GarmentSpec }> | Readonly<{ ok: false; reason: string }>;

/**
 * One part of the kit as a design: the registry type's own starting design, in the club's colours,
 * with the pattern the person chose. The base article's option codes and parameters are not written
 * into the design, because no change in the design contract writes them (decision 0075); they
 * travel to the editor in the address instead (`address.ts`).
 */
export function partSpec(kit: TeamwearKit, part: KitPart, choice: PartChoice, wearer: Wearer): SpecOutcome {
  const started = createSpec(part.typeId, wearer);
  if (!started.ok) return started;
  if (kitStylesFor(part.typeId).length > 0) return withKitStyle(started.spec, choice.pattern, kit.colours);
  const swatch = part.id === "socks" ? kit.socksColour : kit.colours.main;
  const coloured = applyAction(started.spec, colourEverything(started.spec, swatch));
  return coloured.ok ? { ok: true, spec: coloured.spec } : { ok: false, reason: coloured.reason };
}

export type PartPreview =
  | Readonly<{ status: "drawn"; spec: GarmentSpec; flat: FlatPreviewData }>
  | Readonly<{ status: "not-drawn"; reason: string }>;

/**
 * One part of the kit drawn front and back, with the outlines the 3D stage builds its form from.
 * A part the drawing code has no template for is "not drawn yet" with the reason, never a blank
 * canvas and never a stand-in picture of another garment.
 */
export function partPreview(kit: TeamwearKit, part: KitPart, choice: PartChoice, wearer: Wearer): PartPreview {
  const spec = partSpec(kit, part, choice, wearer);
  if (!spec.ok) return { status: "not-drawn", reason: spec.reason };
  const flat = flatPreview(spec.spec, new Map());
  return flat === null ? { status: "not-drawn", reason: STAGE_NOT_DRAWN } : { status: "drawn", spec: spec.spec, flat };
}

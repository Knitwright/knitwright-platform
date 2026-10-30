import { applyAction, createSpec, panelsFor, type GarmentSpec, type SpecAction, type Wearer } from "@/lib/garment";
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
 * the browser for every change after it, which is why a colour answers at once.
 */

/**
 * The panels that take the club's second colour. Every other panel is the body and takes the main
 * colour. It is the same split as `lib/kit-styles/presets.ts`, which cannot be called here: its
 * style table lists the studio types (`team-jersey`, `crew-tee`) and not the teamwear ones
 * (`football-shirt`, `football-shorts`), so `kitStyleActions` refuses every part of a kit.
 * **Owner question** on the pull request: should the kit-style table list the teamwear types, so one
 * function colours a kit everywhere?
 */
const TRIM_PANELS = ["neckband", "collar", "cuffs", "side-panels", "waistband", "placket"];

/** The colourway for one part: the body in one colour, the trims in another, and nothing else touched. */
function colourwayFor(spec: GarmentSpec, body: string, trim: string): SpecAction {
  const colours = panelsFor(spec).map((panel) => ({
    panelId: panel.id,
    colour: "",
    // A panel the trim table does not name is part of the body: a kit is one colour before it is two.
    swatch: TRIM_PANELS.includes(panel.id) ? trim : body,
    provenance: "user-edited" as const,
  }));
  return { type: "update-colourway", colourway: { ...spec.colourways[0], colours } };
}

export type SpecOutcome = Readonly<{ ok: true; spec: GarmentSpec }> | Readonly<{ ok: false; reason: string }>;

/**
 * One part of the kit as a design: the registry type's own starting design in the club's colours.
 * The base article's option codes and parameters are not written into the design, because no change
 * in the design contract writes them (decision 0075); they travel to the editor in the address
 * instead (`address.ts`).
 */
export function partSpec(kit: TeamwearKit, part: KitPart, _choice: PartChoice, wearer: Wearer): SpecOutcome {
  const started = createSpec(part.typeId, wearer);
  if (!started.ok) return started;
  const body = part.id === "socks" ? kit.socksColour : kit.colours.main;
  const trim = part.id === "socks" ? kit.colours.main : kit.colours.second;
  const coloured = applyAction(started.spec, colourwayFor(started.spec, body, trim));
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

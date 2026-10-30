import type { EditorDesign } from "@/lib/editor/slots";
import { panelsFor, type Artwork } from "@/lib/garment";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";
import type { Applied } from "./apply";
import { CONVERT_NOT_AVAILABLE, NOT_AVAILABLE } from "./background";
import { techniqueAllowed, techniqueChoices, unknownDecorationProfile, type DecorationProfile, type Technique, type TechniqueChoice } from "./techniques";
import type { Unstored } from "./pattern-fill";

/**
 * The Edit Graphic panel of spec F-S4 (plan v5 Y3, decision 0076): the name and preview, Remove
 * background, Convert to pattern fill, the colours, the type, the size in millimetres, the position
 * in millimetres from the panel anchor, rotation, flip, align, apply to sizes, and delete.
 *
 * A design stores artwork in tenths of a millimetre from a named anchor on a panel
 * (`lib/garment/parts.ts`), so this panel reads and writes exactly that and nothing else. The
 * controls the spec asks for that the stored shape has no field for — the graphic's own colours, a
 * flip, and grading its position by size — are listed under `unstored` with their reason, not drawn
 * as controls that quietly do nothing.
 */

/** Tenths of a millimetre, as a design stores them, to millimetres and back. */
const mm = (tenths: number): number => Math.round(tenths) / 10;
const tenths = (value: number): number => Math.round(value * 10);

export interface GraphicNumber {
  readonly id: "width" | "height" | "offsetX" | "offsetY" | "rotationDegrees";
  readonly label: string;
  readonly unit: "mm" | "degrees";
  readonly value: number;
}

export interface AnchorChoice {
  readonly id: string;
  readonly label: string;
  readonly chosen: boolean;
}

export interface GraphicView {
  readonly id: string;
  readonly name: string;
  /** What the graphic is: an uploaded file, or text to print. */
  readonly source: string;
  readonly panelId: string;
  readonly panelLabel: string;
  readonly anchors: readonly AnchorChoice[];
  readonly numbers: readonly GraphicNumber[];
  readonly techniques: readonly TechniqueChoice[];
  /** The ratio a size lock keeps: width over height, as it is now. */
  readonly ratio: number;
  readonly unstored: readonly Unstored[];
  /** The one alignment that can be worked out without the piece mapper. */
  readonly alignNote: string;
}

const NOT_STORED = "A design has no field for this yet, so the editor will not pretend to set it.";
const NO_MAPPER =
  "Only “centre on the anchor” can be worked out today: where an anchor sits on a pattern piece needs the piece mapper (decision 0053), which is not built, and the editor will not guess a position.";

/** The graphic of this id, as the panel shows it. Null when the design has no such artwork. */
export function graphicView(design: EditorDesign, artworkId: string, profile: DecorationProfile = unknownDecorationProfile()): GraphicView | null {
  const art = design.spec.artwork.find((entry) => entry.id === artworkId);
  if (art === undefined) return null;
  const panel = panelsFor(design.spec).find((entry) => entry.id === art.panelId);
  return {
    id: art.id,
    name: art.name,
    source: art.source.kind === "text" ? `Text “${art.source.text}”` : "An uploaded file",
    panelId: art.panelId,
    panelLabel: panel?.label ?? art.panelId,
    anchors: (panel?.anchors ?? []).map((anchor) => ({ id: anchor.id, label: anchor.label, chosen: anchor.id === art.anchor })),
    numbers: [
      { id: "width", label: "Width", unit: "mm", value: mm(art.width) },
      { id: "height", label: "Height", unit: "mm", value: mm(art.height) },
      { id: "offsetX", label: "X from the anchor", unit: "mm", value: mm(art.offsetX) },
      { id: "offsetY", label: "Y from the anchor", unit: "mm", value: mm(art.offsetY) },
      { id: "rotationDegrees", label: "Rotation", unit: "degrees", value: art.rotationDegrees },
    ],
    techniques: techniqueChoices(profile, art.technique),
    ratio: art.height === 0 ? 1 : art.width / art.height,
    unstored: [
      { label: "Colours", reason: `A graphic is printed as it was supplied; the editor does not recolour an uploaded file. ${NOT_STORED}`, ruleId: GAP_RULE_ID },
      { label: "Flip", reason: `Mirroring a graphic changes the artwork, not its placement. ${NOT_STORED}`, ruleId: GAP_RULE_ID },
      {
        label: "Apply to sizes",
        reason: `The base article states whether a placement is graded or fixed (“scale_by_size”), and a design cannot yet override it. ${NOT_STORED}`,
        ruleId: GAP_RULE_ID,
      },
    ],
    alignNote: NO_MAPPER,
  };
}

const fail = (reason: string): Applied => ({ ok: false, reason });

const saved = (art: Artwork, words: string): Applied => ({
  ok: true,
  steps: [{ kind: "save", key: `graphic-${art.id}`, action: { type: "update-artwork", artwork: art } }],
  words,
});

const found = (design: EditorDesign, artworkId: string): Artwork | undefined => design.spec.artwork.find((entry) => entry.id === artworkId);

const MAX_ANGLE = 359;

/** One number of the graphic, in millimetres (or whole degrees for the rotation). */
export function setGraphicNumber(design: EditorDesign, artworkId: string, id: GraphicNumber["id"], value: number, lockRatio = false): Applied {
  const art = found(design, artworkId);
  if (art === undefined) return fail("This design has no such graphic.");
  if (!Number.isFinite(value)) return fail("That is not a number.");
  if (id === "rotationDegrees") {
    const angle = Math.round(value);
    if (angle < 0 || angle > MAX_ANGLE) return fail(`A rotation runs from 0 to ${MAX_ANGLE} degrees.`);
    return saved({ ...art, rotationDegrees: angle, provenance: "user-edited" }, `${art.name} turned to ${angle} degrees.`);
  }
  if ((id === "width" || id === "height") && value <= 0) return fail("A graphic needs a width and a height greater than zero.");
  const sized = lockRatio && (id === "width" || id === "height") ? withRatio(art, id, value) : { [id]: tenths(value) };
  return saved({ ...art, ...sized, provenance: "user-edited" }, `${art.name} ${id === "width" || id === "height" ? "sized" : "moved"} to ${value} mm.`);
}

/** Keeps the graphic's shape: the other side moves with the one that changed. */
function withRatio(art: Artwork, id: "width" | "height", value: number): { width: number; height: number } {
  const ratio = art.height === 0 ? 1 : art.width / art.height;
  if (id === "width") return { width: tenths(value), height: Math.max(1, tenths(value / (ratio === 0 ? 1 : ratio))) };
  return { width: Math.max(1, tenths(value * ratio)), height: tenths(value) };
}

/** Puts the graphic back on its anchor, the one alignment that needs no piece geometry. */
export function centreOnAnchor(design: EditorDesign, artworkId: string): Applied {
  const art = found(design, artworkId);
  if (art === undefined) return fail("This design has no such graphic.");
  return saved({ ...art, offsetX: 0, offsetY: 0, provenance: "user-edited" }, `${art.name} centred on ${art.anchor}.`);
}

/** Moves the graphic to another anchor of its own panel. An anchor the panel does not have is refused. */
export function setGraphicAnchor(design: EditorDesign, artworkId: string, anchorId: string): Applied {
  const art = found(design, artworkId);
  if (art === undefined) return fail("This design has no such graphic.");
  const panel = panelsFor(design.spec).find((entry) => entry.id === art.panelId);
  if (!panel?.anchors.some((anchor) => anchor.id === anchorId)) return fail(`${panel?.label ?? art.panelId} has no place called ${anchorId}.`);
  return saved({ ...art, anchor: anchorId, provenance: "user-edited" }, `${art.name} moved to ${anchorId}.`);
}

/** Sets how the graphic is put on: only a method the factory profile lists, or the article's own. */
export function setGraphicTechnique(design: EditorDesign, artworkId: string, technique: Technique, profile: DecorationProfile = unknownDecorationProfile()): Applied {
  const art = found(design, artworkId);
  if (art === undefined) return fail("This design has no such graphic.");
  if (!techniqueAllowed(profile, technique)) return fail(`${profile.label} So ${technique} cannot be chosen here.`);
  return saved({ ...art, technique, provenance: "user-edited" }, `${art.name} will be put on by ${technique}.`);
}

/** Takes the graphic off the design. */
export function removeGraphic(design: EditorDesign, artworkId: string): Applied {
  const art = found(design, artworkId);
  if (art === undefined) return fail("This design has no such graphic.");
  return { ok: true, steps: [{ kind: "save", key: `graphic-${art.id}`, action: { type: "remove-artwork", id: art.id } }], words: `${art.name} was taken off.` };
}

/** Remove background and Convert to pattern fill: neither is wired, and each says so in its own words. */
export const graphicActionsNotWired = (): readonly Unstored[] => [
  { label: "Remove background", reason: NOT_AVAILABLE, ruleId: GAP_RULE_ID },
  { label: "Convert to pattern fill", reason: CONVERT_NOT_AVAILABLE, ruleId: GAP_RULE_ID },
];

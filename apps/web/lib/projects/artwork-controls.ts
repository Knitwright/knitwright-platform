import {
  MEASUREMENT_MAX_TENTHS_MM,
  TECHNIQUES,
  TENTHS_MM_PER_CM,
  artworkSchema,
  panelsFor,
  type Artwork,
  type GarmentSpec,
  type SpecAction,
} from "@/lib/garment";
import { cmText, parseCmInput } from "./measurement-input";

/** What a piece of artwork is made of: a stored picture, or a line of text. */
export type ArtworkSource = Readonly<{ kind: "file"; fileId: string }> | Readonly<{ kind: "text"; text: string }>;

/** The fields of the add and change forms, all as the text a person typed. */
export interface ArtworkForm {
  readonly source: ArtworkSource;
  readonly name: string;
  readonly panelId: string;
  readonly anchorId: string;
  readonly widthCm: string;
  readonly heightCm: string;
  /** How far to move it across (plus is right) and down (plus is down), as the drawing is seen. */
  readonly offsetXCm: string;
  readonly offsetYCm: string;
  readonly rotation: string;
  readonly technique: string;
}

type ArtworkRequest =
  | Readonly<{ kind: "action"; action: SpecAction }>
  | Readonly<{ kind: "problem"; reason: string }>;

export interface Part {
  readonly panelId: string;
  readonly label: string;
  readonly anchors: readonly { readonly id: string; readonly label: string }[];
}

/** The panels of this design that can carry artwork, and the places on each. */
export const placeableParts = (spec: GarmentSpec): readonly Part[] =>
  panelsFor(spec)
    .filter((panel) => panel.anchors.length > 0)
    .map((panel) => ({ panelId: panel.id, label: panel.label, anchors: panel.anchors.map((a) => ({ id: a.id, label: a.label })) }));

export const ANCHOR_CHOICES = (spec: GarmentSpec, panelId: string): readonly { id: string; label: string }[] =>
  placeableParts(spec).find((part) => part.panelId === panelId)?.anchors ?? [];

const TECHNIQUE_LABELS: Readonly<Record<(typeof TECHNIQUES)[number], string>> = {
  sublimation: "Sublimation",
  transfer: "Heat transfer",
  "screen-print": "Screen print",
  embroidery: "Embroidery",
};

export const TECHNIQUE_CHOICES: readonly { id: string; label: string }[] = TECHNIQUES.map((id) => ({ id, label: TECHNIQUE_LABELS[id] }));

const DEFAULT_WIDTH_CM = 8;
const DEFAULT_TEXT_HEIGHT_CM = 3;
const DEFAULT_TECHNIQUE = "screen-print";
const ROTATION_MESSAGE = "Enter whole degrees from 0 to 359.";
const MAX_ROTATION = 359;

/** A signed length in centimetres, such as 2 or -1.5, kept as whole tenths of a millimetre. */
export function parseOffsetCm(text: string): { ok: true; tenths: number } | { ok: false } {
  const match = /^(-?)(\d+)(?:[.,](\d{0,2}))?$/.exec(text.trim());
  if (!match) return { ok: false };
  const tenths = Number(match[2]) * TENTHS_MM_PER_CM + Number((match[3] ?? "").padEnd(2, "0"));
  if (tenths > MEASUREMENT_MAX_TENTHS_MM) return { ok: false };
  return { ok: true, tenths: match[1] === "-" ? -tenths : tenths };
}

export function parseRotation(text: string): { ok: true; degrees: number } | { ok: false; reason: string } {
  const trimmed = text.trim();
  const degrees = Number(trimmed);
  return /^\d{1,3}$/.test(trimmed) && degrees <= MAX_ROTATION ? { ok: true, degrees } : { ok: false, reason: ROTATION_MESSAGE };
}

/** A form for new artwork, on the centre of the chest, with a size that keeps the shape of a picture. */
export function defaultArtworkForm(spec: GarmentSpec, source: ArtworkSource, picture?: { width: number; height: number }): ArtworkForm {
  const part = placeableParts(spec)[0];
  const height = picture && picture.width > 0 ? (DEFAULT_WIDTH_CM * picture.height) / picture.width : source.kind === "text" ? DEFAULT_TEXT_HEIGHT_CM : DEFAULT_WIDTH_CM;
  return {
    source,
    name: "",
    panelId: part?.panelId ?? "",
    anchorId: part?.anchors[0]?.id ?? "",
    widthCm: String(DEFAULT_WIDTH_CM),
    heightCm: String(Math.round(height * 100) / 100),
    offsetXCm: "0",
    offsetYCm: "0",
    rotation: "0",
    technique: DEFAULT_TECHNIQUE,
  };
}

/** Moves a form to another part and starts at the first place on it. A part that cannot carry artwork changes nothing. */
export function withPart(spec: GarmentSpec, form: ArtworkForm, panelId: string): ArtworkForm {
  const part = placeableParts(spec).find((candidate) => candidate.panelId === panelId);
  return part ? { ...form, panelId, anchorId: part.anchors[0]?.id ?? "" } : form;
}

export const fieldsFromArtwork = (art: Artwork): ArtworkForm => ({
  source: art.source,
  name: art.name,
  panelId: art.panelId,
  anchorId: art.anchor,
  widthCm: cmText(art.width),
  heightCm: cmText(art.height),
  offsetXCm: cmText(art.offsetX),
  offsetYCm: cmText(art.offsetY),
  rotation: String(art.rotationDegrees),
  technique: art.technique,
});

const sizeOf = (text: string, noun: string, example: number): number | string => {
  const parsed = parseCmInput(text);
  return parsed.ok ? parsed.tenths : `Enter a ${noun} in centimetres, such as ${example}.`;
};

const moveOf = (text: string, direction: string): number | string => {
  const parsed = parseOffsetCm(text);
  return parsed.ok ? parsed.tenths : `Enter how far to move it ${direction} in centimetres, such as 2 or -2.`;
};

const defaultName = (form: ArtworkForm, partLabel: string): string =>
  form.name.trim() !== "" ? form.name : `${form.source.kind === "text" ? "Text" : "Logo"} on ${partLabel}`;

/**
 * Turns the fields of a form into a change for the server, or into a plain reason why not.
 * A browser cannot say where the artwork came from, so no source is written here: the
 * server stamps it. The design given is not changed.
 */
export function buildArtworkAction(spec: GarmentSpec, form: ArtworkForm, id: string, mode: "add" | "update" = "add"): ArtworkRequest {
  const part = placeableParts(spec).find((candidate) => candidate.panelId === form.panelId);
  if (!part) return problem("Choose a part that can carry artwork.");
  if (!part.anchors.some((anchor) => anchor.id === form.anchorId)) return problem("Choose a place on the part.");
  const width = sizeOf(form.widthCm, "width", 8);
  const height = sizeOf(form.heightCm, "height", 5);
  const across = moveOf(form.offsetXCm, "across");
  const down = moveOf(form.offsetYCm, "down");
  const turn = parseRotation(form.rotation);
  for (const found of [width, height, across, down]) if (typeof found === "string") return problem(found);
  if (!turn.ok) return problem(turn.reason);
  const candidate = {
    id,
    name: defaultName(form, part.label),
    source: form.source,
    panelId: form.panelId,
    anchor: form.anchorId,
    offsetX: across,
    offsetY: down,
    width,
    height,
    rotationDegrees: turn.degrees,
    technique: form.technique,
    // A browser has no say in this. The server replaces it with `user-edited`.
    provenance: "user-edited",
  };
  const checked = artworkSchema.safeParse(candidate);
  if (!checked.success) return problem(checked.error.issues[0]?.message ?? "That artwork cannot be used.");
  return { kind: "action", action: { type: mode === "add" ? "add-artwork" : "update-artwork", artwork: checked.data } };
}

const problem = (reason: string): ArtworkRequest => ({ kind: "problem", reason });

export const removeArtworkAction = (id: string): ArtworkRequest => ({ kind: "action", action: { type: "remove-artwork", id } });

export interface ArtworkRow {
  readonly id: string;
  readonly name: string;
  readonly kindLabel: string;
  readonly partLabel: string;
  readonly placeLabel: string;
  readonly fields: ArtworkForm;
}

/** Every piece of artwork in the design, described in words with its fields ready to edit. */
export function artworkRows(spec: GarmentSpec): readonly ArtworkRow[] {
  const parts = placeableParts(spec);
  return spec.artwork.map((art) => {
    const part = parts.find((candidate) => candidate.panelId === art.panelId);
    return {
      id: art.id,
      name: art.name,
      kindLabel: art.source.kind === "file" ? "Picture" : "Text",
      partLabel: part?.label ?? art.panelId,
      placeLabel: part?.anchors.find((anchor) => anchor.id === art.anchor)?.label ?? art.anchor,
      fields: fieldsFromArtwork(art),
    };
  });
}

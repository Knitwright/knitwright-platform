import { normaliseSwatch } from "@/lib/projects/colour-controls";
import type { NamesNumbersForm } from "@/lib/projects/names-numbers-controls";
import { splitColour } from "./colour";
import type { Zone } from "./zones";

/**
 * The preview roster entry on the 3D view (spec F-S4 "A preview roster entry ('SMITH 7') shows on
 * 3D"). A fresh design starts at SMITH and 7, so the preview reads exactly as the spec's example
 * until someone types their own sample.
 *
 * The preview is drawn to show WHERE the lettering goes and HOW it looks, never at the finished
 * size: a height nobody typed is not guessed, as decision 0027 item 9 holds. The words under it say
 * so, so the picture is never read as a measurement.
 */

export const SPEC_SAMPLE_NAME = "SMITH";
export const SPEC_SAMPLE_NUMBER = "7";

/** The one line under the preview. It says plainly what the picture is and is not. */
export const PREVIEW_NOTE = "Drawn to show where the lettering goes and how it looks. Not drawn to the finished size.";

/** Where the preview falls back to when no colour is drawn: the chalk of the 3D mannequin. */
const DEFAULT_FILL = "#f4f4f5";

export interface MarkPreview {
  /** "SMITH 7", or whatever sample the design holds. */
  readonly roster: string;
  readonly sampleName: string;
  readonly sampleNumber: string;
  readonly fill: string;
  /** The outline's colour where one was given as a colour, or null. */
  readonly outlineFill: string | null;
  /** The outline as it was written, where it is a name rather than a colour. */
  readonly outlineWords: string | null;
  /** The zones the preview shows, in the order the base article offers them. */
  readonly zones: readonly Readonly<{ place: string; label: string; shows: "name" | "number" }>[];
  readonly note: string;
}

const showsOf = (place: string): "name" | "number" => (place === "back-name" ? "name" : "number");

/** What the 3D view draws for the lettering as the form stands now. */
export function markPreview(form: NamesNumbersForm, zones: readonly Zone[]): MarkPreview {
  const { outline } = splitColour(form.colour);
  const outlineFill = normaliseSwatch(outline);
  const sampleName = form.sampleName.trim().length > 0 ? form.sampleName.trim() : SPEC_SAMPLE_NAME;
  const sampleNumber = form.sampleNumber.trim().length > 0 ? form.sampleNumber.trim() : SPEC_SAMPLE_NUMBER;
  return {
    roster: `${sampleName} ${sampleNumber}`,
    sampleName,
    sampleNumber,
    fill: normaliseSwatch(form.swatch) ?? DEFAULT_FILL,
    outlineFill: outlineFill && outlineFill.startsWith("#") ? outlineFill : null,
    outlineWords: outline.length > 0 && !(outlineFill && outlineFill.startsWith("#")) ? outline : null,
    zones: zones
      .filter((zone) => zone.on)
      .map((zone) => ({ place: zone.place, label: zone.label, shows: showsOf(zone.place) })),
    note: PREVIEW_NOTE,
  };
}

import type { EditorDesign } from "@/lib/editor/slots";
import { panelsFor, SWATCH_PATTERN, type Colourway, type SpecAction } from "@/lib/garment";
import { kitPatternProblem } from "@/lib/garment/kit-pattern";
import { sizeParamOf } from "@/lib/artwork-stack/legacy/kit-styles";
import { tenthsFromMm } from "@/lib/artwork-stack/units";
import type { LibraryItem } from "./library";

/**
 * What the shell is asked to do when a library item is applied (plan v5 Y3, decision 0076). Spec
 * F-S4: "click to apply to all pieces, or drag onto a single panel".
 *
 * Every change here is a design-diff patch — a `SpecAction` the shell saves, or an option the shell
 * sets — and never a picture. The shell checks each one against the base article's approved options
 * and ranges before it is stored, so this file never needs to re-check them: it only says which
 * change the person asked for. A change the stored design has no field for is refused in words,
 * never applied silently and never faked.
 */

export type ApplyTarget = { readonly kind: "all" } | { readonly kind: "panel"; readonly panelId: string };

export type ApplyStep =
  | { readonly kind: "save"; readonly key: string; readonly action: SpecAction }
  | { readonly kind: "option"; readonly group: string; readonly code: string };

export type Applied =
  | { readonly ok: true; readonly steps: readonly ApplyStep[]; readonly words: string }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): Applied => ({ ok: false, reason });

/** The panels the change goes on: one, or every panel the garment has. */
export function panelsOf(design: EditorDesign, target: ApplyTarget): readonly string[] {
  if (target.kind === "panel") return [target.panelId];
  return panelsFor(design.spec).map((panel) => panel.id);
}

/** A local id nothing in the design is using. */
function freeId(taken: readonly { readonly id: string }[], prefix: string): string {
  const used = new Set(taken.map((entry) => entry.id));
  let n = 1;
  while (used.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/**
 * A fabric from the Knitwright library: added to the design if it is not on it yet, then put on the
 * panels. The article states its weight as a range ("140-160"), which one integer cannot hold, so
 * the weight is left unset and the range stays on the library card.
 */
function applyFabric(design: EditorDesign, item: LibraryItem, target: ApplyTarget): Applied {
  if (item.apply.kind !== "fabric") return fail("That is not a fabric.");
  const { code, composition } = item.apply;
  const existing = design.spec.fabrics.find((fabric) => fabric.name === code);
  const id = existing?.id ?? freeId(design.spec.fabrics, "fabric");
  const panels = panelsOf(design, target);
  if (panels.length === 0) return fail("This garment has no panels, so there is nothing to put the fabric on.");
  const add: readonly ApplyStep[] = existing
    ? []
    : [
        {
          kind: "save",
          key: `library-fabric-${code}`,
          action: {
            type: "add-fabric",
            fabric: { id, name: code, composition, construction: "", weightGsm: null, finish: "", consumption: "", stretch: "not-set", provenance: "user-edited" },
          },
        },
      ];
  return {
    ok: true,
    steps: [...add, ...panels.map((panelId): ApplyStep => ({ kind: "save", key: `library-fabric-${code}-${panelId}`, action: { type: "assign-fabric", panelId, fabricId: id } }))],
    words: target.kind === "all" ? `${code} on every panel.` : `${code} on ${target.panelId}.`,
  };
}

/** A colour: the colourway's entry for each panel, with the screen colour and no colour reference. */
function applyColour(design: EditorDesign, item: LibraryItem, target: ApplyTarget): Applied {
  if (item.apply.kind !== "colour") return fail("That is not a colour.");
  const { swatch } = item.apply;
  if (!SWATCH_PATTERN.test(swatch)) return fail("That is not a screen colour the editor can draw.");
  const colourway = design.spec.colourways.find((way) => way.id === design.colourwayId) ?? design.spec.colourways[0];
  const panels = panelsOf(design, target);
  if (panels.length === 0) return fail("This garment has no panels, so there is nothing to colour.");
  const kept = colourway.colours.filter((entry) => !panels.includes(entry.panelId));
  const next: Colourway = {
    ...colourway,
    colours: [...kept, ...panels.map((panelId) => ({ panelId, colour: "", swatch, provenance: "user-edited" as const }))],
  };
  return {
    ok: true,
    steps: [{ kind: "save", key: `library-colour-${colourway.id}`, action: { type: "update-colourway", colourway: next } }],
    words: target.kind === "all" ? `${item.label} on every panel of ${colourway.name}.` : `${item.label} on ${target.panelId}.`,
  };
}

/** The colour a new pattern is printed in: the one it already has, else the colourway's last distinct swatch. */
function patternColour(design: EditorDesign): string | null {
  const first = design.spec.kitPattern?.colours[0]?.swatch;
  if (first !== undefined) return first;
  const swatches = [...new Set((design.spec.colourways.find((way) => way.id === design.colourwayId) ?? design.spec.colourways[0]).colours.flatMap((entry) => (entry.swatch === undefined ? [] : [entry.swatch])))];
  return swatches.at(-1) ?? null;
}

/** A pattern fill: the article's own approved option, or one of the kit styles the design can store. */
function applyPattern(design: EditorDesign, item: LibraryItem, target: ApplyTarget): Applied {
  if (item.apply.kind === "option") return { ok: true, steps: [{ kind: "option", group: item.apply.group, code: item.apply.code }], words: `${item.label} (${item.apply.code}).` };
  if (item.apply.kind === "none") return fail(item.apply.reason);
  if (item.apply.kind !== "kit-pattern") return fail("That is not a pattern fill.");
  if (target.kind === "panel") return fail("A kit pattern is printed over the body of the whole garment, so it cannot go on one panel on its own.");
  const problem = kitPatternProblem(design.spec.typeId);
  if (problem !== null) return fail(problem);
  const swatch = patternColour(design);
  if (swatch === null) return fail("Give the design a colour first: a pattern is printed over the body colour, and this design has none.");
  const size = item.apply.params[sizeParamOf(item.apply.style)];
  return {
    ok: true,
    steps: [
      {
        kind: "save",
        key: "library-pattern-fill",
        action: {
          type: "set-kit-pattern",
          kitPattern: {
            style: item.apply.style,
            colours: design.spec.kitPattern?.colours ?? [{ colour: "", swatch }],
            ...(typeof size === "number" ? { size: tenthsFromMm(size) } : {}),
            provenance: "user-edited",
          },
        },
      },
    ],
    words: `${item.label} over the body colour.`,
  };
}

/** The steps that apply one library item, or why it cannot be applied. */
export function applyItem(design: EditorDesign, item: LibraryItem, target: ApplyTarget): Applied {
  if (design.article === null && item.kind === "fabric") return fail("This design is not on a base article, so the approved fabric list does not apply to it.");
  switch (item.kind) {
    case "fabric":
      return applyFabric(design, item, target);
    case "colour":
      return applyColour(design, item, target);
    case "pattern-fill":
      return applyPattern(design, item, target);
    default:
      return fail("Knitwright has no graphics library on file yet, so there is nothing to apply.");
  }
}

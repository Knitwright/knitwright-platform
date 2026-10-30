import { currentStack, type ArtworkStack } from "@/lib/artwork-stack";
import type { GarmentSpec } from "@/lib/garment";
import { DRAFT_NOTICE } from "@/lib/pattern-library/dxf/write";
import { createPrintFileBuilder } from "@/lib/print/build/file-builder";
import { fileStem } from "@/lib/print/build/names";
import { makeFiles } from "@/lib/print/build/package";
import { planPrintFiles, type Format, type PlanEntry } from "@/lib/print/build/plan";
import { instancesOf } from "@/lib/print/frames/instances";
import type { PrintContext } from "@/lib/print/inputs/context";
import { defaultsNoteFor, SHRINK_NOT_APPLIED } from "@/lib/print/inputs/notes";
import type { DesignPattern } from "@/lib/print/inputs/pattern";
import type { StoredPrintProfile } from "@/lib/print/profiles";
import type { GradedPattern } from "@/lib/production/contract";
import type { KppFactory, KppPrintRules, PanelPrintFile, PrintSource } from "../model";

/**
 * `04_print/**` from the print builder the platform already has (decision 0031, `lib/print`), which is the
 * last seam decision 0070 left open — and the one thing that kept the export route unmounted (0070 revision 2,
 * "Still owed after this revision").
 *
 * **One pattern, one package.** The print files are drawn on the very `GradedPattern` that `03_patterns/**`
 * comes from: the drafted one (`sources/pattern.ts`, decision 0070 revision 1). They are *not* drawn on the
 * brand's pattern-library pattern, which is what `lib/print/inputs/pattern.ts` reads for the print download. A
 * package whose print files and its patterns disagree is worse than no package, and `docs/spec/04`'s own
 * Phase 0 test measures exactly that agreement. `DesignPattern` — print's own input — already carries a
 * `GradedPattern`, which is what the drafter returns, so this file is the adapter and the per-panel call,
 * nothing more.
 *
 * `lib/print` is reached through its public API only: `planPrintFiles`, `createPrintFileBuilder`, `makeFiles`
 * and `fileStem`, driven together as `lib/print/service.ts` already drives them for the print download.
 * Nothing in `lib/print` is changed, and no number is invented here: bleed and resolution are the package's
 * own, stated in `00_README.pdf` and checked by `lib/kpp/gate.ts`.
 */

/** The factory's file type as the print contract names its formats. `EXTENSIONS` maps `tiff` back to `.tif`. */
const FORMAT_OF: Readonly<Record<KppFactory["printFileType"], Format>> = { pdf: "pdf", tif: "tiff" };

/** Which pattern the files are drawn on, for the margin of every file. */
export interface DraftedFacts {
  /** The pattern `03_patterns/**` is written from, so the two cannot disagree. */
  readonly pattern: GradedPattern;
  readonly articleCode: string;
  /** The base article's own version, as `article.json` gives it ("0.1"); `pattern.blockVersion` is the platform's. */
  readonly articleVersion: string;
  /** The code that drew it, named in every margin. */
  readonly drafter: string;
}

/** What drew the pattern, in the words a factory reads. */
export const DRAFTED_BY = "Knitwright's graded parametric drafter (lib/parametric)";

/**
 * The drafted pattern as `lib/print` takes it. `reviewed` is **false** and says so in words: this is a
 * Knitwright draft and no factory has looked at it (plan v5 owner decision 10 — an article cannot go live
 * without a factory-checked master pattern, and none exists). The note is printed in every file's margin, so
 * it names the article, the article's version, the platform's block version and the drafter, and it ends with
 * the pattern library's own draft notice. Nothing here may read as a sign-off nobody gave.
 */
export function draftedDesignPattern(drafted: DraftedFacts): Extract<DesignPattern, { ok: true }> {
  const note = `Pattern: Knitwright draft of ${drafted.articleCode}, article version ${drafted.articleVersion}, block v${drafted.pattern.blockVersion}, drawn by ${drafted.drafter}. ${DRAFT_NOTICE}`;
  return { ok: true, pattern: drafted.pattern, reviewed: false, note };
}

export interface PrintSourceInput {
  readonly drafted: DraftedFacts;
  /** The design, for its artwork stack and its garment type (which decides the print zones). */
  readonly spec: GarmentSpec;
  /** The colourway the package is for. The caller picks it; this file never guesses one. */
  readonly colourwayId: string;
  readonly printFileType: KppFactory["printFileType"];
  /** The package's own print thresholds, so the files are made at the numbers the package states. */
  readonly print: KppPrintRules;
  /** The brand's print profile, league rules, colour profile and artwork reader. */
  readonly context: PrintContext;
}

export interface DraftedPrint {
  readonly source: PrintSource;
  /** Sentences for the package's own notes (`KppInput.notes`), which `00_README.pdf` prints. */
  readonly notes: readonly string[];
}

/** Said when a size is asked for that the drafted pattern does not hold: a reason in words, not a crash inside the mapper. */
export const noSizeReason = (article: string, size: string): string =>
  `Print files: size ${size} is not in the drafted pattern for ${article}, so no print file could be made for it.`;

/**
 * No team list reaches this seam. `08_personalisation/names_numbers.csv` is a list of names and numbers, not a
 * team order: `RosterRow` also wants the cut and the quantity, and inventing either would make an
 * unpersonalised file look personalised. So the package says so, and every file in `04_print` is the plain panel.
 */
export const NO_TEAM_LIST =
  "No team list reaches the print files, so no file in 04_print carries a player's name or number: every one is the plain panel. A batch's names and numbers are in 08_personalisation/names_numbers.csv for the factory to apply.";

/**
 * How the rest of the package names this panel. `lib/kpp/assemble.ts` hands it to `printPath`, which writes
 * `SAMPLE_<article>_<panel>_<size>.<ext>`, and the package's own tests expect `front`, `back`, `sleeve-left`
 * and `sleeve-right` — which is exactly `lib/print`'s own file stem for a piece with nobody's name on it (the
 * `PieceInstance.id`, the view the piece is printed for). Taking the stem rather than the piece id keeps the
 * two names one name the day a team list does reach this seam: the stem then carries the player's number and
 * the transfer marks, so two files of one panel cannot land on one path.
 */
const panelOf = (entry: PlanEntry): string => fileStem(entry.spec.pieceId, entry.player, entry.transferOnly);

/**
 * The profile `lib/print` builds to. Bleed and resolution are the package's own, so a file is made at the
 * numbers `00_README.pdf` states and `lib/kpp/gate.ts` checked. Everything else is the brand's stored profile —
 * the print house's colour profile, its largest width, and whether those numbers are the print house's own or
 * Knitwright's default, which is what the margin note is taken from.
 */
const profileFor = (input: PrintSourceInput): StoredPrintProfile => ({
  ...input.context.profile,
  bleedMm: input.print.bleedMm,
  dpi: input.print.dpi,
  minDpi: input.print.minDpi,
});

/** Drafted pieces no print view is defined for, by the piece's own name, each named once. */
const notPrinted = (pattern: GradedPattern): readonly string[] =>
  [...new Set(Object.values(pattern.piecesBySize).flatMap((pieces) => instancesOf(pieces, "").unplaced))].sort();

function notesFor(input: PrintSourceInput, patternNote: string): readonly string[] {
  const missing = notPrinted(input.drafted.pattern);
  return [
    `Print files are drawn on the same pattern as 03_patterns. ${patternNote}`,
    NO_TEAM_LIST,
    ...(missing.length === 0 ? [] : [`No print view is defined for ${missing.join(", ")}, so 04_print holds no file for them. 03_patterns carries them.`]),
  ];
}

const builderFor = (input: PrintSourceInput, pattern: Extract<DesignPattern, { ok: true }>, stack: ArtworkStack, profile: StoredPrintProfile) =>
  createPrintFileBuilder({
    pattern: input.drafted.pattern,
    stack,
    colourwayId: input.colourwayId,
    assets: input.context.assets,
    rules: input.context.rules,
    roster: null,
    garment: input.spec.typeId,
    minDpi: profile.minDpi,
    // No fabric shrink test reaches the package, so nothing is scaled and every file says so.
    scaleNote: SHRINK_NOT_APPLIED,
    defaultsNote: defaultsNoteFor(profile),
    patternReviewed: pattern.reviewed,
    patternNote: pattern.note,
    ...(input.context.icc ? { icc: input.context.icc } : {}),
  });

/**
 * The package's `PrintSource`: one size in, one file per printed piece out, in the factory's own format.
 *
 * `files` takes the order number as well, because a batch package groups `04_print` by order. It makes the
 * same panels whatever the order, because no team list reaches this seam (see `NO_TEAM_LIST`) — so the one
 * thing the order changes is the path, which `lib/kpp/paths.ts` writes. The day a team list does arrive, the
 * roster goes to `planPrintFiles` and `panelOf` already carries the player.
 *
 * Deterministic: the same design, pattern, profile and size give the same bytes. `lib/print`'s builder says so
 * of itself, the plan reads no clock, and nothing here holds state between calls.
 */
export function printSource(input: PrintSourceInput): DraftedPrint {
  const pattern = draftedDesignPattern(input.drafted);
  const stack = currentStack(input.spec);
  const profile = profileFor(input);
  const formats: readonly Format[] = [FORMAT_OF[input.printFileType]];
  const files = async (size: string): Promise<readonly PanelPrintFile[]> => {
    if (!input.drafted.pattern.sizes.includes(size)) throw new RangeError(noSizeReason(input.drafted.articleCode, size));
    const plan = planPrintFiles({ pattern: input.drafted.pattern, stack, sizes: [size], formats, profile, roster: null });
    const made = await makeFiles(builderFor(input, pattern, stack, profile), plan.entries);
    return made.map(({ entry, file }) => ({ panel: panelOf(entry), bytes: file.bytes }));
  };
  return { source: { files: (size) => files(size) }, notes: notesFor(input, pattern.note) };
}

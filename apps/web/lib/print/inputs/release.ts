import type { GarmentSpec } from "@/lib/garment";
import { currentStack } from "@/lib/artwork-stack";
import type { PrintFileBuilder, RosterRow } from "@/lib/production/contract";
import { AppError } from "@/lib/server/core/errors";
import { createPrintFileBuilder } from "../build/file-builder";
import { defaultsNoteFor, SHRINK_NOT_APPLIED } from "./notes";
import type { PrintContext } from "./context";
import type { DesignPattern } from "./pattern";

/** What a release's builder needs, each fetched only when the first file is asked for. */
export interface ReleaseDeps {
  readonly project: () => Promise<{ readonly spec: GarmentSpec }>;
  readonly pattern: (typeId: string) => Promise<DesignPattern>;
  readonly context: () => Promise<PrintContext>;
}

/**
 * The print file builder a release freezes with and checks a reorder against (W4's `PrintFileBuilder`). It is the same
 * builder the download uses, made from the design's real stack, the library's graded pattern, the brand's artwork reader,
 * print profile, colour profile and rules, and the team list the release was made from. Nothing is read until the first
 * file is built, and then once: a release that is refused (a team list with problems) never reads a pattern.
 */
export function createReleaseBuilder(deps: ReleaseDeps, roster: readonly RosterRow[] | null): PrintFileBuilder {
  let made: Promise<PrintFileBuilder> | undefined;
  const load = async (): Promise<PrintFileBuilder> => {
    const { spec } = await deps.project();
    const found = await deps.pattern(spec.typeId);
    if (!found.ok) throw new AppError("invalid_input", found.reason);
    const context = await deps.context();
    const stack = currentStack(spec);
    return createPrintFileBuilder({
      pattern: found.pattern,
      stack,
      colourwayId: stack.colourways[0]?.id ?? "main",
      assets: context.assets,
      rules: context.rules,
      roster: roster === null ? null : { rows: roster },
      garment: spec.typeId,
      minDpi: context.profile.minDpi,
      scaleNote: SHRINK_NOT_APPLIED,
      defaultsNote: defaultsNoteFor(context.profile),
      patternReviewed: found.reviewed,
      patternNote: found.note,
      ...(context.icc ? { icc: context.icc } : {}),
    });
  };
  return {
    build: async (spec) => {
      made ??= load();
      return (await made).build(spec);
    },
  };
}

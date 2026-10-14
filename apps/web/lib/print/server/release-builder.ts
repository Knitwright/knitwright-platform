import type { SupabaseClient } from "@supabase/supabase-js";
import type { PrintFileBuilder } from "@/lib/production/contract";
import type { OpenProject } from "@/lib/projects/project-reads";
import { createPrintFileBuilder } from "../builder";
import { printDeps } from "./deps";
import { prepare } from "./serve";

/** A team list row as a release holds it: the name and number on a player's files, and the label the size is cut from. */
export interface ReleaseRosterRow {
  readonly name: string;
  readonly number: string;
  readonly sizeLabel?: string;
}

export interface ReleaseBuilderInput {
  /** The person's own client and the server's, as the download route uses them. */
  readonly client: SupabaseClient;
  readonly admin: SupabaseClient;
  readonly brandId: string;
  /** Reads the design the release is made from: the current version. */
  readonly load: (projectId: string) => Promise<OpenProject>;
}

/**
 * The print file builder for a release (W4), made lazily: nothing is read until the first file is asked for, then the design,
 * the pattern and the brand's assets are read once and every spec builds from them. Same signature as W4's `BuilderFor`:
 * `(context: { projectId, roster }) => PrintFileBuilder`.
 */
export function releasePrintBuilder(input: ReleaseBuilderInput): (context: { projectId: string; roster: readonly ReleaseRosterRow[] | null }) => PrintFileBuilder {
  return ({ projectId, roster }) => {
    let ready: Promise<PrintFileBuilder> | undefined;
    const builder = (): Promise<PrintFileBuilder> =>
      (ready ??= prepare(printDeps({ client: input.client, admin: input.admin, brandId: input.brandId, load: () => input.load(projectId) }), { query: {} }).then(
        ({ env }) => createPrintFileBuilder({ env, ...(roster === null ? {} : { roster }) }),
      ));
    return { build: async (spec) => (await builder()).build(spec) };
  };
}

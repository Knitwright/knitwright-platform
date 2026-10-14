import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPrintContext } from "@/lib/print/inputs/context";
import { loadDesignPattern } from "@/lib/print/inputs/pattern";
import { createReleaseBuilder } from "@/lib/print/inputs/release";
import { getProject } from "@/lib/projects/service";
import type { BuilderFor } from "./use-cases";

/**
 * The print file builder the routes use: the real one (W3). It makes the same files as the print download, from the
 * design as it is now, the pattern the release names at the version it was frozen with, the brand's artwork,
 * print profile, colour profile and rules, and the team list the release is made from. The files are hashed and
 * never kept. `client` is the person's own, so the database decides what they may read; `admin` is only for the
 * artwork reader, which answers for one brand.
 */
export const printFileBuilder =
  (clients: { readonly client: SupabaseClient; readonly admin: SupabaseClient }, brandId: string): BuilderFor =>
  ({ projectId, roster, patternBlockId, patternBlockVersion }) =>
    createReleaseBuilder(
      {
        project: () => getProject(clients.client, brandId, projectId),
        pattern: (typeId) => loadDesignPattern(clients.client, brandId, { typeId, blockId: patternBlockId, blockVersion: patternBlockVersion }),
        context: () => loadPrintContext(clients, brandId),
      },
      roster,
    );

import type { SupabaseClient } from "@supabase/supabase-js";
import { listFabrics, listSavedSizeMaps } from "@/lib/fabrics/service";
import { profileWithTests } from "@/lib/fabrics/profile";
import { effectiveSizeMaps } from "@/lib/fabrics/size-maps";
import type { OpenProject } from "@/lib/projects/project-reads";
import { createFileReader } from "@/lib/storage/read";
import { loadBundledFont, type Font } from "../text/font";
import { composeAssetReaders, createLegacyAssetReader } from "./assets";
import { rulesFor } from "./rules";
import type { PrintDeps } from "./serve";
import { loadPrintSettings } from "./settings";

export interface DepsInput {
  /** The person's own client: reads go through the database's rules. */
  readonly client: SupabaseClient;
  readonly brandId: string;
  /** Reads the design (a version, else the current one). The route joins it to the project functions. */
  readonly load: (options: { version?: number }) => Promise<OpenProject>;
  /** The league rule set to hold the files to, when the person chose one. */
  readonly ruleSetId?: string;
}

let font: Promise<Font> | undefined;
/** The bundled font is read once per server process. */
const sharedFont = (): Promise<Font> => (font ??= loadBundledFont());

/**
 * Joins a download to the brand's data. Every read uses the person's own client and the brand from the session, never from the
 * request. A user's logo is read through the brand's file reader, so another brand's file is not found.
 */
export function printDeps(input: DepsInput): PrintDeps {
  const reader = createFileReader(input.client, input.brandId);
  return {
    load: input.load,
    settings: () => loadPrintSettings(input.client, reader, input.brandId),
    rules: () => rulesFor(input.client, input.brandId, input.ruleSetId),
    fabric: async (fabricId) => {
      const found = (await listFabrics(input.client, input.brandId)).find((f) => f.id === fabricId);
      return found === undefined ? null : { name: found.name, profile: profileWithTests(found.sheet, found.tests).profile };
    },
    sizeMaps: async () => effectiveSizeMaps(await listSavedSizeMaps(input.client, input.brandId)),
    assets: composeAssetReaders(createLegacyAssetReader(reader)),
    font: sharedFont,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { seedMarketingTemplates } from "@/lib/marketing/templates/seed";
import { seedKitBundles } from "./bundles/seed";
import { seedTemplates } from "./seed";
import { seedTechpackTemplates } from "./techpacks/seed";

/**
 * The whole template library in one step (plan v6 D5, decision 0136): the starter designs, the kit bundles, the
 * tech pack templates and the marketing templates. `pnpm --filter web seed:templates` runs it, locally after a
 * database reset and on the hosted project after `supabase db push` (docs/runbooks/supabase-hosted.md).
 *
 * Every step finds its rows by slug, so running it again changes the rows it made and adds nothing, and a row a
 * platform admin reviewed is left as it is. The order matters: a kit bundle names its designs by slug and the
 * database holds it to a real row, so the designs go in first, and a failed step stops the rest.
 */

export interface LibrarySeed {
  readonly templates: number;
  readonly bundles: number;
  readonly techpacks: number;
  readonly marketing: number;
}

export interface SeedStep {
  readonly name: keyof LibrarySeed;
  readonly run: (admin: SupabaseClient) => Promise<number>;
}

export const LIBRARY_SEED_STEPS: readonly SeedStep[] = [
  { name: "templates", run: seedTemplates },
  { name: "bundles", run: seedKitBundles },
  { name: "techpacks", run: seedTechpackTemplates },
  { name: "marketing", run: seedMarketingTemplates },
];

export async function seedLibrary(admin: SupabaseClient, steps: readonly SeedStep[] = LIBRARY_SEED_STEPS): Promise<LibrarySeed> {
  const written: Record<keyof LibrarySeed, number> = { templates: 0, bundles: 0, techpacks: 0, marketing: 0 };
  for (const step of steps) written[step.name] = await step.run(admin);
  return written;
}

export const describeLibrarySeed = (seed: LibrarySeed): string =>
  `${seed.templates} starter templates, ${seed.bundles} kit bundles, ${seed.techpacks} tech pack templates and ` +
  `${seed.marketing} marketing templates written.`;

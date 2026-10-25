import type { SupabaseClient } from "@supabase/supabase-js";
import { rosterContextOf } from "@/lib/orders/context";
import { getProject } from "@/lib/projects/project-reads";
import { listReleases, type ReleaseSummary } from "@/lib/releases/service";
import { loadFactoryProfile } from "@/lib/validation/service";
import type { FactoryProfile } from "@/lib/validation/profile";
import type { Moq } from "./breakdown";
import type { PriceLadder } from "./quote";

/** Everything the run builder shows and checks against, for one product's design. */
export interface RunContext {
  readonly garmentType: string;
  readonly garmentLabel: string;
  readonly designName: string;
  /** The design's size run. Empty when the design has none. */
  readonly sizeRun: readonly string[];
  readonly factoryProfileId: string;
  readonly factoryLabel: string;
  readonly moq: Moq;
  readonly ladder: PriceLadder;
  readonly fabrics: readonly string[];
  readonly releases: readonly ReleaseSummary[];
}

/** The factory's terms for one garment type. A garment the profile does not list has no minimum set. */
export function termsFor(profile: FactoryProfile, garmentType: string): Pick<RunContext, "moq" | "ladder" | "fabrics" | "factoryProfileId" | "factoryLabel"> {
  const article = profile.articles.find((a) => a.typeId === garmentType);
  return {
    factoryProfileId: profile.id,
    factoryLabel: profile.label,
    moq: article?.moq ?? { status: "not-set" },
    ladder: profile.priceLadder,
    fabrics: profile.fabrics.map((f) => f.name),
  };
}

export async function loadRunContext(client: SupabaseClient, brandId: string, projectId: string): Promise<RunContext> {
  const [project, profile, releases] = await Promise.all([getProject(client, brandId, projectId), loadFactoryProfile(client), listReleases(client, brandId, projectId)]);
  return {
    garmentType: project.garmentType,
    garmentLabel: project.garmentLabel,
    designName: project.name,
    sizeRun: rosterContextOf(project.spec).run,
    ...termsFor(profile, project.garmentType),
    releases,
  };
}

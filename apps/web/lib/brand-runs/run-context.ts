import type { SupabaseClient } from "@supabase/supabase-js";
import type { GarmentSpec } from "@/lib/garment/spec-schema";
import { rosterContextOf } from "@/lib/orders/context";
import { getProject } from "@/lib/projects/project-reads";
import { listReleases, type ReleaseSummary } from "@/lib/releases/service";
import { catalogueFrom } from "@/lib/validation/live-ports";
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
  /**
   * The design as it stands, so the order can name every picture it uses to the content review
   * (security review v5 H3, decision 0116). It is read here already.
   */
  readonly spec: GarmentSpec;
  /**
   * The base article's production class, or null when no article covers this garment type. A Class
   * B run needs a person to have looked at the design before it starts (spec F-G1).
   */
  readonly productionClass: "A" | "B" | null;
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
  const article = await catalogueFrom(client).articleForType(project.garmentType);
  return {
    garmentType: project.garmentType,
    garmentLabel: project.garmentLabel,
    designName: project.name,
    sizeRun: rosterContextOf(project.spec).run,
    ...termsFor(profile, project.garmentType),
    releases,
    spec: project.spec,
    productionClass: article?.productionClass ?? null,
  };
}

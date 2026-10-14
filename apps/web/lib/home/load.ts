import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { brandChartSet } from "@/lib/charts/service";
import { quoteStatusSchema } from "@/lib/leads/quote";
import type { PageRequest } from "@/lib/pagination/pages";
import { PROJECT_COLUMNS, projectRowSchema } from "@/lib/projects/rows";
import { listProjects, readSpec, summaryOf, throwIfFailed, type ProjectSummary } from "@/lib/projects/service";
import { log } from "@/lib/server/log";
import type { ChartSet } from "@/lib/sizing";
import { cardFacts, type Thumbnail } from "./card";
import { openVotes, type HomeAnswer, type HomeLink } from "./facts";
import { journeyStep, type JourneyStepId } from "./journey";
import { needsYou, type DesignFacts, type NeedsYou, type QuoteFact } from "./needs-you";
import { changedWhen } from "./when";

/**
 * Everything the studio home reads, in a fixed number of bounded queries whatever the number of
 * designs: one page of designs, the designs changed most recently, their contents and their
 * share, quote and download marks, the brand's open share links and their answers, and its open
 * quote requests. All of it goes through the signed-in member's own client, so the database's
 * rules decide what they see.
 */

/** How many recently changed designs the "Needs you" list looks at for empty fields. */
export const RECENT_DESIGNS = 12;
/** The most open share links read for the brand, and the most answers read for them. */
export const OPEN_LINKS_READ = 50;
export const ANSWERS_READ = 1000;
/** The most open quote requests read for the brand. */
export const OPEN_QUOTES_READ = 20;

export interface HomeCard extends ProjectSummary {
  readonly step: JourneyStepId;
  /** When it was last changed, in words. */
  readonly changed: string;
  readonly thumbnail: Thumbnail | null;
}

export interface StudioHome {
  readonly cards: readonly HomeCard[];
  readonly total: number;
  readonly needsYou: NeedsYou;
}

type Brand = Readonly<{ id: string; name: string }>;

interface Marks {
  readonly shared: boolean;
  readonly quoted: boolean;
  readonly downloaded: boolean;
}

const NO_MARKS: Marks = { shared: false, quoted: false, downloaded: false };

const recentProjects = async (client: SupabaseClient, brandId: string): Promise<ProjectSummary[]> => {
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RECENT_DESIGNS);
  throwIfFailed(error);
  return z.array(projectRowSchema).parse(data ?? []).map(summaryOf);
};

const marksRow = z.object({
  id: z.uuid(),
  share_links: z.array(z.unknown()),
  quote_requests: z.array(z.unknown()),
  export_downloads: z.array(z.unknown()),
});

/** Whether each design was ever shared, quoted or downloaded: one query, at most one row of each. */
const designMarks = async (client: SupabaseClient, brandId: string, ids: readonly string[]): Promise<Map<string, Marks>> => {
  const { data, error } = await client
    .from("projects")
    .select("id, share_links(id), quote_requests(id), export_downloads(id)")
    .eq("brand_id", brandId)
    .in("id", ids)
    .limit(1, { referencedTable: "share_links" })
    .limit(1, { referencedTable: "quote_requests" })
    .limit(1, { referencedTable: "export_downloads" });
  throwIfFailed(error);
  return new Map(
    z
      .array(marksRow)
      .parse(data ?? [])
      .map((row) => [
        row.id,
        { shared: row.share_links.length > 0, quoted: row.quote_requests.length > 0, downloaded: row.export_downloads.length > 0 },
      ]),
  );
};

const specRow = z.object({ project_id: z.uuid(), version: z.number().int(), spec: z.unknown() });

/** The current version of each design, in one query. */
const currentSpecs = async (client: SupabaseClient, brandId: string, designs: readonly ProjectSummary[]) => {
  const pairs = designs.map((design) => `and(project_id.eq.${design.id},version.eq.${design.currentVersion})`);
  const { data, error } = await client
    .from("spec_versions")
    .select("project_id, version, spec, created_at")
    .eq("brand_id", brandId)
    .or(pairs.join(","))
    .limit(designs.length);
  throwIfFailed(error);
  return z.array(specRow.extend({ created_at: z.string() })).parse(data ?? []);
};

const linkRow = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
});
const answerRow = z.object({ link_id: z.uuid(), vote: z.enum(["yes", "not_yet"]).nullable(), updated_at: z.string() });

const openLinks = async (client: SupabaseClient, brandId: string, now: Date): Promise<HomeLink[]> => {
  const { data, error } = await client
    .from("share_links")
    .select("id, project_id, created_at, expires_at, revoked_at")
    .eq("brand_id", brandId)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(OPEN_LINKS_READ);
  throwIfFailed(error);
  return z
    .array(linkRow)
    .parse(data ?? [])
    .map((row) => ({ id: row.id, projectId: row.project_id, createdAt: row.created_at, expiresAt: row.expires_at, revokedAt: row.revoked_at }));
};

const linkAnswers = async (client: SupabaseClient, brandId: string, links: readonly HomeLink[]): Promise<HomeAnswer[]> => {
  if (links.length === 0) return [];
  const { data, error } = await client
    .from("share_responses")
    .select("link_id, vote, updated_at")
    .eq("brand_id", brandId)
    .in(
      "link_id",
      links.map((link) => link.id),
    )
    .order("updated_at", { ascending: false })
    .limit(ANSWERS_READ);
  throwIfFailed(error);
  return z
    .array(answerRow)
    .parse(data ?? [])
    .map((row) => ({ linkId: row.link_id, vote: row.vote, updatedAt: row.updated_at }));
};

const quoteRow = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  quantity: z.number().int(),
  status: quoteStatusSchema,
  updated_at: z.string(),
});

const openQuotes = async (client: SupabaseClient, brandId: string) => {
  const { data, error } = await client
    .from("quote_requests")
    .select("id, project_id, quantity, status, updated_at")
    .eq("brand_id", brandId)
    .in("status", ["new", "quoted"])
    .order("updated_at", { ascending: false })
    .limit(OPEN_QUOTES_READ);
  throwIfFailed(error);
  return z.array(quoteRow).parse(data ?? []);
};

/** The names of designs the other reads did not bring, in one query. */
const namesOf = async (client: SupabaseClient, brandId: string, ids: readonly string[]): Promise<Map<string, string>> => {
  if (ids.length === 0) return new Map();
  const { data, error } = await client.from("projects").select("id, name").eq("brand_id", brandId).in("id", ids).limit(ids.length);
  throwIfFailed(error);
  return new Map(
    z
      .array(z.object({ id: z.uuid(), name: z.string() }))
      .parse(data ?? [])
      .map((row) => [row.id, row.name]),
  );
};

type Facts = Readonly<{ toConfirm: number | null; thumbnail: Thumbnail | null }>;
const UNKNOWN: Facts = { toConfirm: null, thumbnail: null };

/** Each design's empty fields and drawing. A design that cannot be read is logged and shown without them. */
function contentFacts(
  designs: readonly ProjectSummary[],
  rows: Awaited<ReturnType<typeof currentSpecs>>,
  brand: Brand,
  charts: ChartSet,
  now: Date,
): Map<string, Facts> {
  const specOf = new Map(rows.map((row) => [row.project_id, row]));
  return new Map(
    designs.map((design) => {
      const row = specOf.get(design.id);
      if (!row) return [design.id, UNKNOWN];
      try {
        const { spec, dropped } = readSpec(row.spec);
        return [design.id, cardFacts({ ...design, versionSavedAt: row.created_at, spec, dropped }, brand.name, charts, now)];
      } catch (error) {
        log({ level: "warn", message: "A design could not be read for the studio home.", where: "studio-home", error });
        return [design.id, UNKNOWN];
      }
    }),
  );
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

export async function loadStudioHome(client: SupabaseClient, brand: Brand, request: PageRequest, now: Date): Promise<StudioHome> {
  const { projects, total } = await listProjects(client, brand.id, request.perPage, request.offset);
  if (total === 0) return { cards: [], total, needsYou: { items: [], more: 0 } };

  const [recent, charts, links, quotes] = await Promise.all([
    recentProjects(client, brand.id),
    brandChartSet(client, brand.id),
    openLinks(client, brand.id, now),
    openQuotes(client, brand.id),
  ]);
  const designs = [...projects, ...recent.filter((design) => !projects.some((shown) => shown.id === design.id))];
  const known = new Map(designs.map((design) => [design.id, design.name]));
  const unnamed = unique([...links.map((link) => link.projectId), ...quotes.map((quote) => quote.project_id)]).filter((id) => !known.has(id));

  const [marks, specs, answers, names] = await Promise.all([
    designMarks(client, brand.id, designs.map((design) => design.id)),
    designs.length > 0 ? currentSpecs(client, brand.id, designs) : Promise.resolve([]),
    linkAnswers(client, brand.id, links),
    namesOf(client, brand.id, unnamed),
  ]);
  const facts = contentFacts(designs, specs, brand, charts, now);
  const allNames = new Map([...known, ...names]);
  const factsOf = (id: string): Facts => facts.get(id) ?? UNKNOWN;
  const marksOf = (id: string): Marks => marks.get(id) ?? NO_MARKS;

  const cards = projects.map((project) => ({
    ...project,
    step: journeyStep({ toConfirm: factsOf(project.id).toConfirm, ...marksOf(project.id) }),
    changed: changedWhen(project.updatedAt, now),
    thumbnail: factsOf(project.id).thumbnail,
  }));

  const recentFacts: DesignFacts[] = recent.map((design) => ({
    id: design.id,
    name: design.name,
    updatedAt: design.updatedAt,
    toConfirm: factsOf(design.id).toConfirm,
    shared: marksOf(design.id).shared,
    quoted: marksOf(design.id).quoted,
  }));
  const quoteFacts: QuoteFact[] = quotes.flatMap((quote) => {
    const projectName = allNames.get(quote.project_id);
    return projectName === undefined
      ? []
      : [{ id: quote.id, projectId: quote.project_id, projectName, quantity: quote.quantity, status: quote.status, updatedAt: quote.updated_at }];
  });

  return {
    cards,
    total,
    needsYou: needsYou({ designs: recentFacts, votes: openVotes(links, answers, allNames, now), quotes: quoteFacts }),
  };
}

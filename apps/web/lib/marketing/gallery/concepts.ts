import type { VideoTemplate } from "@/lib/media/video/social-frames";
import { GROUP_LABELS, MARKETING_GROUPS, type MarketingFormat, type MarketingGroup } from "../templates/types";

/**
 * The v3.9 Marketing page (09 screen 9, decision 0140): a Featured concepts row and an Ad gallery
 * of every concept, filtered by All · Photo · Video · Concepts ▾ · Sport ▾.
 *
 * A **photo** concept is one marketing layout of `07` (its first format stands for it, so one
 * layout is one card); a **video** concept is one of `07`'s video templates. Using a photo concept
 * opens a launch canvas with a marketing board on that layout; using a video opens the design's 3D
 * view, where the video studio records it.
 */

export interface LayoutRow {
  readonly slug: string;
  readonly title: string;
  readonly group: MarketingGroup;
  readonly format: MarketingFormat;
  readonly layoutKey: string;
}

export type ConceptUse =
  | Readonly<{ type: "launch"; slug: string }>
  | Readonly<{ type: "link"; href: string }>
  | Readonly<{ type: "unavailable"; reason: string }>;

export type ConceptShape = "square" | "portrait" | "story" | "wide" | "a4";

export interface Concept {
  readonly id: string;
  readonly title: string;
  readonly kind: "photo" | "video";
  /** The marketing group, or null for a video. */
  readonly group: MarketingGroup | null;
  readonly shape: ConceptShape;
  readonly premium: boolean;
  readonly use: ConceptUse;
}

const SHAPES: Readonly<Record<MarketingFormat, ConceptShape>> = {
  "social-square-1-1": "square",
  "social-post-4-5": "portrait",
  "story-9-16": "story",
  "hero-banner-16-9": "wide",
  "a4-print": "a4",
};

/**
 * A layout's own name, without the format the library's row adds after a dash
 * (`../templates/build.ts`: "Matchday — Social square 1:1"). One card stands for every format.
 */
export const layoutTitle = (title: string): string => title.split(" — ")[0]!.trim();

/** One concept per layout, in the library's order. */
export function photoConcepts(rows: readonly LayoutRow[]): readonly Concept[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (seen.has(row.layoutKey)) return [];
    seen.add(row.layoutKey);
    return [{ id: row.layoutKey, title: layoutTitle(row.title), kind: "photo" as const, group: row.group, shape: SHAPES[row.format], premium: false, use: { type: "launch" as const, slug: row.slug } }];
  });
}

/** A video concept: free when the platform draws it, ♛ when a model makes the clip. */
export function videoConcept(template: VideoTemplate, studioHref: string, waiting: string | null): Concept {
  return {
    id: `video-${template.key}`,
    title: template.label,
    kind: "video",
    group: null,
    shape: "story",
    premium: template.source === "ai_clip",
    use: waiting === null ? { type: "link", href: studioHref } : { type: "unavailable", reason: waiting },
  };
}

/**
 * The layouts the Featured row leads with, one per moment of a kit launch. They are layout keys of
 * `07`'s marketing table; a key the library does not hold is simply skipped.
 */
export const FEATURED_LAYOUTS = ["new-kit-reveal", "pre-order-now", "matchday", "player-of-the-match", "sponsor-thank-you", "order-your-kit", "kit-countdown-3"] as const;

export function featuredConcepts(concepts: readonly Concept[]): readonly Concept[] {
  return FEATURED_LAYOUTS.flatMap((key) => concepts.filter((concept) => concept.id === key));
}

export const GALLERY_KINDS = ["all", "photo", "video"] as const;
export type GalleryKind = (typeof GALLERY_KINDS)[number];

export const GALLERY_KIND_LABELS: Readonly<Record<GalleryKind, string>> = { all: "All", photo: "Photo", video: "Video" };

export interface GalleryFilter {
  readonly kind: GalleryKind;
  readonly group: MarketingGroup | null;
  /** A sport tab id: it changes which garment the cards show, never which concepts are listed. */
  readonly sport: string | null;
}

type SearchValue = string | string[] | undefined;
const first = (value: SearchValue): string | undefined => (Array.isArray(value) ? value[0] : value);

export function galleryFilterFromQuery(query: Readonly<Record<string, SearchValue>>, sports: readonly string[]): GalleryFilter {
  const kind = GALLERY_KINDS.find((one) => one === first(query.kind)) ?? "all";
  const group = MARKETING_GROUPS.find((one) => one === first(query.concept)) ?? null;
  const sport = sports.find((one) => one === first(query.sport)) ?? null;
  return { kind, group, sport };
}

/** The gallery for one filter. Choosing a concept group shows photos only: a video has no group. */
export function galleryConcepts(concepts: readonly Concept[], filter: GalleryFilter): readonly Concept[] {
  return concepts.filter(
    (concept) => (filter.kind === "all" || concept.kind === filter.kind) && (filter.group === null || concept.group === filter.group),
  );
}

/** The page's address with the filter changed, keeping the rest. */
export function galleryHref(filter: GalleryFilter): string {
  const query = new URLSearchParams();
  if (filter.kind !== "all") query.set("kind", filter.kind);
  if (filter.group !== null) query.set("concept", filter.group);
  if (filter.sport !== null) query.set("sport", filter.sport);
  const text = query.toString();
  return text ? `/marketing?${text}` : "/marketing";
}

export const GROUP_CHOICES: readonly Readonly<{ id: MarketingGroup; label: string }>[] = MARKETING_GROUPS.map((id) => ({ id, label: GROUP_LABELS[id] }));

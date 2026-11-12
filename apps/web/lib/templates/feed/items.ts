import type { FlowTemplateSpec } from "@/lib/flows/types";
import type { VideoTemplate } from "@/lib/media/video/social-frames";
import { layoutTitle } from "@/lib/marketing/gallery/concepts";
import { GROUP_LABELS, MARKETING_FORMAT_LABELS, type MarketingFormat, type MarketingGroup } from "@/lib/marketing/templates/types";
import { REVIEW_LABELS } from "../catalogue";
import type { TemplateSummary } from "../filters";
import type { TemplatePreview } from "../preview";
import { sportTabsOf, type SportTab } from "./tabs";

/**
 * One card of the Templates page, whatever kind of template it is (decision 0140).
 *
 * The page lists five of `07`'s kinds side by side, and each reaches the flow that already exists
 * for it -- `use` says which. Nothing here reads the database or draws: `server.ts` reads the rows
 * and `withPictures` there draws only the designs on screen.
 */

export type FeedKind = "design" | "pack" | "social" | "video" | "techpack";

export type FeedUse =
  /** The existing "Use this template" action: a copy of the design, opened in the editor. */
  | Readonly<{ type: "design"; templateId: string }>
  /** A new launch canvas opened from a flow pack or a marketing layout. */
  | Readonly<{ type: "launch"; source: "flow" | "marketing"; slug: string }>
  /** A page that already does the job. */
  | Readonly<{ type: "link"; href: string }>
  /** Shown, with the reason it cannot be used yet. Never hidden (10 §9). */
  | Readonly<{ type: "unavailable"; reason: string }>;

export type FeedPicture = Readonly<{ type: "drawing"; src: string; alt: string }> | Readonly<{ type: "tile"; label: string }>;

export interface FeedItem {
  readonly id: string;
  readonly kind: FeedKind;
  readonly title: string;
  /** Who made it: "Knitwright", or a designer's own name. */
  readonly author: string;
  /** ♛: it spends credits when used. */
  readonly premium: boolean;
  readonly sports: readonly SportTab[];
  /** The marketing group a social layout belongs to, or null. */
  readonly group: MarketingGroup | null;
  /** The marketing layout's key, or null. */
  readonly layoutKey: string | null;
  readonly searchText: string;
  /**
   * What the card says about who made it and whether a factory reviewed it: a designer's template
   * always says both, a starter says so only once a factory has reviewed it. Null otherwise.
   */
  readonly note: Readonly<{ text: string; reviewed: boolean }> | null;
  readonly picture: FeedPicture;
  readonly use: FeedUse;
}

const KNITWRIGHT = "Knitwright";

const lower = (...parts: readonly string[]): string => parts.join(" ").toLowerCase();

/** A design template, with the sport tags it carries. Its picture is drawn later, only if shown. */
export interface DesignRow {
  readonly summary: TemplateSummary;
  readonly sportTags: readonly string[];
}

/** The v2.2 card's own words for a designer's template, and the review label for a reviewed starter. */
function noteOf(summary: TemplateSummary): FeedItem["note"] {
  const reviewed = summary.reviewState === "reviewed";
  if (summary.attribution) return { text: `By ${summary.attribution}, ${reviewed ? "reviewed by a factory" : "not reviewed by a factory"}`, reviewed };
  return reviewed ? { text: REVIEW_LABELS.reviewed, reviewed } : null;
}

export function designItem({ summary, sportTags }: DesignRow): FeedItem {
  const author = summary.attribution ?? KNITWRIGHT;
  return {
    id: summary.id,
    kind: "design",
    title: summary.title,
    author,
    premium: false,
    sports: sportTabsOf(sportTags, summary.sport),
    group: null,
    layoutKey: null,
    searchText: lower(summary.title, author, summary.sport, ...sportTags, ...summary.styleTags, summary.colourFamily),
    note: noteOf(summary),
    picture: { type: "tile", label: "Kit" },
    use: { type: "design", templateId: summary.id },
  };
}

export function packItem(spec: FlowTemplateSpec): FeedItem {
  return {
    id: `pack-${spec.slug}`,
    kind: "pack",
    title: spec.title,
    author: KNITWRIGHT,
    premium: false,
    sports: [],
    group: null,
    layoutKey: null,
    searchText: lower(spec.title, spec.lead, "launch pack"),
    note: null,
    picture: { type: "tile", label: `${spec.assets} assets` },
    use: { type: "launch", source: "flow", slug: spec.slug },
  };
}

export interface SocialRow {
  readonly slug: string;
  readonly title: string;
  readonly group: MarketingGroup;
  readonly format: MarketingFormat;
  readonly layoutKey: string;
}

/** One card per layout: a layout comes in several formats, and the first one in slug order stands for it. */
export function socialItems(rows: readonly SocialRow[]): readonly FeedItem[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (seen.has(row.layoutKey)) return [];
    seen.add(row.layoutKey);
    return [
      {
        id: `social-${row.slug}`,
        kind: "social" as const,
        title: layoutTitle(row.title),
        author: KNITWRIGHT,
        premium: false,
        sports: [],
        group: row.group,
        layoutKey: row.layoutKey,
        searchText: lower(row.title, GROUP_LABELS[row.group], "social"),
        note: null,
        picture: { type: "tile" as const, label: MARKETING_FORMAT_LABELS[row.format] },
        use: { type: "launch" as const, source: "marketing" as const, slug: row.slug },
      },
    ];
  });
}

/**
 * A video template. One the platform draws itself opens the design's 3D view, where the video
 * studio records it; one that waits on something says what (`waitingLine`), and is not offered.
 */
export function videoItem(template: VideoTemplate, studioHref: string, waiting: string | null): FeedItem {
  return {
    id: `video-${template.key}`,
    kind: "video",
    title: template.label,
    author: KNITWRIGHT,
    premium: template.source === "ai_clip",
    sports: [],
    group: null,
    layoutKey: null,
    searchText: lower(template.label, "video"),
    note: null,
    picture: { type: "tile", label: `${template.seconds} s` },
    use: waiting === null ? { type: "link", href: studioHref } : { type: "unavailable", reason: waiting },
  };
}

export interface TechpackRow {
  readonly id: string;
  readonly title: string;
}

/** A tech pack template is applied to a design's tech pack, so using one starts a design. */
export const techpackItem = (row: TechpackRow): FeedItem => ({
  id: row.id,
  kind: "techpack",
  title: row.title,
  author: KNITWRIGHT,
  premium: false,
  sports: [],
  group: null,
  layoutKey: null,
  searchText: lower(row.title, "tech pack"),
    note: null,
  picture: { type: "tile", label: "Tech pack" },
  use: { type: "link", href: "/studio/start" },
});

/** The item with its drawing, when one could be drawn. */
export const withPicture = (item: FeedItem, preview: TemplatePreview | null): FeedItem =>
  preview === null ? item : { ...item, picture: { type: "drawing", src: preview.src, alt: preview.alt } };

/** True when every word typed is somewhere in the item's title, author or tags. */
export function matchesWords(item: FeedItem, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/u).filter((word) => word !== "");
  return words.every((word) => item.searchText.includes(word));
}

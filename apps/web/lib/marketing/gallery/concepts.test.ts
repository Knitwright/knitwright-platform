import { describe, expect, it } from "vitest";
import { VIDEO_TEMPLATES } from "@/lib/media/video/social-frames";
import {
  FEATURED_LAYOUTS,
  GALLERY_KIND_LABELS,
  GALLERY_KINDS,
  GROUP_CHOICES,
  featuredConcepts,
  galleryConcepts,
  galleryFilterFromQuery,
  galleryHref,
  photoConcepts,
  videoConcept,
  type LayoutRow,
} from "./concepts";

const rows: readonly LayoutRow[] = [
  { slug: "matchday-square", title: "Matchday", group: "club-life", format: "social-square-1-1", layoutKey: "matchday" },
  { slug: "matchday-story", title: "Matchday", group: "club-life", format: "story-9-16", layoutKey: "matchday" },
  { slug: "new-kit-reveal-post", title: "New kit reveal", group: "kit-launch", format: "social-post-4-5", layoutKey: "new-kit-reveal" },
  { slug: "web-banner-wide", title: "Web banner", group: "e-commerce", format: "hero-banner-16-9", layoutKey: "web-banner" },
  { slug: "a4-poster-a4", title: "A4 poster", group: "print", format: "a4-print", layoutKey: "a4-poster" },
];

const photos = photoConcepts(rows);
const videos = [videoConcept(VIDEO_TEMPLATES[0]!, "/studio/d?view=3d", null), videoConcept(VIDEO_TEMPLATES.find((one) => one.source === "ai_clip")!, "/s", "Waits.")];
const all = [...photos, ...videos];

describe("the marketing concepts", () => {
  it("makes one photo concept per layout, shaped by its first format, opening a canvas on it", () => {
    expect(photos.map((one) => [one.id, one.shape])).toEqual([
      ["matchday", "square"],
      ["new-kit-reveal", "portrait"],
      ["web-banner", "wide"],
      ["a4-poster", "a4"],
    ]);
    expect(photos[0]!.use).toEqual({ type: "launch", slug: "matchday-square" });
  });

  it("offers a video the platform draws and says why an AI clip waits, with its crown", () => {
    expect(videos[0]).toMatchObject({ kind: "video", premium: false, use: { type: "link", href: "/studio/d?view=3d" } });
    expect(videos[1]).toMatchObject({ premium: true, use: { type: "unavailable", reason: "Waits." } });
  });

  it("leads the featured row with the launch moments the library holds, in order", () => {
    expect(featuredConcepts(all).map((one) => one.id)).toEqual(["new-kit-reveal", "matchday"]);
    expect(FEATURED_LAYOUTS.length).toBeGreaterThanOrEqual(6);
  });

  it("filters by kind and by concept group", () => {
    expect(galleryConcepts(all, { kind: "video", group: null, sport: null })).toHaveLength(2);
    expect(galleryConcepts(all, { kind: "photo", group: null, sport: null })).toHaveLength(4);
    expect(galleryConcepts(all, { kind: "all", group: "club-life", sport: null }).map((one) => one.id)).toEqual(["matchday"]);
    expect(galleryConcepts(all, { kind: "all", group: null, sport: "cricket" })).toHaveLength(6);
  });

  it("reads the filter from the address, dropping what it does not know", () => {
    expect(galleryFilterFromQuery({ kind: "video", concept: "print", sport: "cricket" }, ["cricket"])).toEqual({ kind: "video", group: "print", sport: "cricket" });
    expect(galleryFilterFromQuery({ kind: ["x"], concept: "nope", sport: "golf" }, ["cricket"])).toEqual({ kind: "all", group: null, sport: null });
  });

  it("writes the address of a filter", () => {
    expect(galleryHref({ kind: "all", group: null, sport: null })).toBe("/marketing");
    expect(galleryHref({ kind: "photo", group: "print", sport: "gym" })).toBe("/marketing?kind=photo&concept=print&sport=gym");
  });

  it("labels every chip and concept group", () => {
    for (const kind of GALLERY_KINDS) expect(GALLERY_KIND_LABELS[kind]).toBeTruthy();
    expect(GROUP_CHOICES.map((one) => one.label)).toContain("Team store");
  });
});

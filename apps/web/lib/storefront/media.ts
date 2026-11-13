import { z } from "zod";
import type { MediaItem } from "./listing";

/**
 * THE MOCKUP LIBRARY'S POOL (09 screen 23 "Mockup library modal"; spec F-L4 "Publish to store sends listing images
 * to F-L5/F-L6").
 *
 * What a listing may show: the platform's own render of the design (true to colour, never AI), and every picture a
 * Mockup studio or Flow run handed over for this design (`flow_listings`), each carrying its "AI-generated" label
 * where a model made or touched it. Nothing else can be picked, so no third-party image ever reaches a listing.
 */

export const RENDER_ITEM: MediaItem = { id: "render-front", source: "render", ref: "front", label: "Product render", aiLabel: null };

const flowMedia = z.object({
  fileId: z.uuid(),
  name: z.string().max(200),
  role: z.enum(["image", "video"]),
  label: z.string().nullable(),
});

const flowPayload = z.object({ designProjectId: z.uuid().nullable(), media: z.array(z.unknown()) }).loose();

/** The pictures handed over for one design, newest hand-off first, each once. Clips are left for a later channel. */
export function poolFromHandOffs(payloads: readonly unknown[], designProjectId: string): readonly MediaItem[] {
  const seen = new Set<string>();
  const items: MediaItem[] = [];
  for (const raw of payloads) {
    const payload = flowPayload.safeParse(raw);
    if (!payload.success || payload.data.designProjectId !== designProjectId) continue;
    for (const entry of payload.data.media) {
      const media = flowMedia.safeParse(entry);
      if (!media.success || media.data.role !== "image" || seen.has(media.data.fileId)) continue;
      seen.add(media.data.fileId);
      items.push({ id: `flow-${media.data.fileId}`, source: "flow", ref: media.data.fileId, label: media.data.name.slice(0, 120) || "Mockup", aiLabel: media.data.label ? media.data.label.slice(0, 40) : null });
    }
  }
  return items;
}

/** The whole pool: the render first, then the hand-offs. */
export const mediaPool = (handOffs: readonly MediaItem[], hasRender: boolean): readonly MediaItem[] => (hasRender ? [RENDER_ITEM, ...handOffs] : handOffs);

/** A saved selection kept to what the pool still holds, so a picture removed upstream disappears here too. */
export const stillInPool = (selected: readonly MediaItem[], pool: readonly MediaItem[]): readonly MediaItem[] => {
  const ids = new Set(pool.map((item) => item.id));
  return selected.filter((item) => ids.has(item.id));
};

/** The file ids a selection needs links for. */
export const fileIdsOf = (items: readonly MediaItem[]): readonly string[] => items.filter((item) => item.source === "flow").map((item) => item.ref);

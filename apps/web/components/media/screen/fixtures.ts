import type { MediaItemView, MediaSetView } from "@/lib/media/view";

/** Builders for the tests of the media screen. Plain objects in the shape the API sends. */

export const PROJECT = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
export const SET = "7a0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b22";

let counter = 0;
const uuid = (): string => `8b0b1c1e-6a3b-4f6e-9f43-${String(++counter).padStart(12, "0")}`;

export const item = (over: Partial<MediaItemView> & Pick<MediaItemView, "kind" | "view">): MediaItemView => {
  const id = over.id ?? uuid();
  return {
    id,
    fileId: uuid(),
    width: 1024,
    height: 1024,
    watermarked: true,
    checker: "not_checked",
    provider: "studio",
    costMicrodollars: 0,
    href: `/api/projects/${PROJECT}/media/${SET}/items/${id}`,
    ...over,
  };
};

export const studio = (): MediaItemView[] => [
  item({ kind: "studio_render", view: "front" }),
  item({ kind: "studio_render", view: "back" }),
  item({ kind: "studio_render", view: "flat_lay" }),
];

export const lifestyle = (views: readonly MediaItemView["view"][], checker: MediaItemView["checker"] = "passed"): MediaItemView[] =>
  views.map((view) => item({ kind: "lifestyle", view, checker, provider: "stub" }));

export const setOf = (over: Partial<MediaSetView> = {}): MediaSetView => ({
  id: SET,
  projectId: PROJECT,
  version: 3,
  versionHash: "hash",
  status: "succeeded",
  error: null,
  unlocked: false,
  items: studio(),
  ...over,
});

/** The set as the API sends it once credits are spent: no item is watermarked. */
export const unlocked = (set: MediaSetView): MediaSetView => ({
  ...set,
  unlocked: true,
  items: set.items.map((entry) => ({ ...entry, watermarked: false })),
});

import type { SetRecord } from "../ports";

export type VideoItemView = Readonly<{ id: string; kind: "turntable" | "clip"; videoHref: string | null; locked: boolean; aiGenerated: boolean }>;

/**
 * The video items of a set as the browser sees them. A clip that is still locked has no address for its file at all; the
 * poster picture is reached through the ordinary item address.
 */
export const videoItems = (set: SetRecord): readonly VideoItemView[] =>
  set.items.flatMap((item) => {
    if (item.kind !== "turntable" && item.kind !== "clip") return [];
    const locked = item.kind === "clip" && !set.unlocked;
    return [
      {
        id: item.id,
        kind: item.kind,
        locked,
        aiGenerated: item.kind === "clip",
        videoHref: locked ? null : `/api/projects/${set.projectId}/media/${set.id}/items/${item.id}/video`,
      },
    ];
  });

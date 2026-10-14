import type { SizeLabelMap } from "@/lib/production/contract";
import { DEFAULT_SIZE_LABEL_MAPS } from "@/lib/sizing";

export const sizeMapKey = (m: Pick<SizeLabelMap, "wearer" | "cut" | "label">): string => `${m.wearer}|${m.cut}|${m.label}`;

/**
 * The size map a brand works with: the suggested default for every label, with the brand's own
 * choices in place of the ones it has made. A saved choice for a label the runs no longer have is dropped.
 */
export function effectiveSizeMaps(saved: readonly SizeLabelMap[]): readonly SizeLabelMap[] {
  const own = new Map(saved.map((m) => [sizeMapKey(m), m]));
  return DEFAULT_SIZE_LABEL_MAPS.map((m) => own.get(sizeMapKey(m)) ?? m);
}

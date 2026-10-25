import type { MediaKind, MediaView } from "./contract";

/**
 * Where a clean picture is kept. The first folder is not a brand's id, so the storage rule that lets
 * members read their brand's folder (`private.brand_id_from` answers null for it) does not reach it.
 */
export const CLEAN_FOLDER = "_private";

export const cleanPath = (brandId: string, setId: string, kind: MediaKind, view: MediaView): string =>
  `${CLEAN_FOLDER}/${brandId}/${setId}/${kind}-${view}.png`;

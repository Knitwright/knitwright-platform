import type { MediaKind, MediaView } from "../contract";
import { CLEAN_FOLDER } from "../paths";

/** Where a video is kept. Same private folder as a clean picture; the poster frame is the picture at the `.png` path. */
export const videoPath = (brandId: string, setId: string, kind: MediaKind, view: MediaView): string => `${CLEAN_FOLDER}/${brandId}/${setId}/${kind}-${view}.video`;

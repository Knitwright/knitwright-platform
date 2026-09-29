import type { ImageBytes } from "@/lib/flat/images";
import type { StoredBytes } from "@/lib/storage/read";
import { MAX_INPUT_PIXELS, shrinkPicture } from "@/lib/storage/thumbnail";
import { PRINT_EDGE } from "./limits";

/**
 * A copy of a stored picture for a PDF, sized for print and not for the screen: its longest side is
 * PRINT_EDGE pixels at most. The type is kept and a picture is never made larger. Bytes that are not
 * a picture give null.
 */
export const shrinkForPrint = (file: StoredBytes, maxInputPixels: number = MAX_INPUT_PIXELS): Promise<ImageBytes | null> =>
  shrinkPicture(file, PRINT_EDGE, maxInputPixels);

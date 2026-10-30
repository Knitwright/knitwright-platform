import { uploadArtwork, type Outcome, type UploadedArtwork } from "@/lib/artwork-intake/client";
import { publishable, type RepeatDraft, type RepeatFinding } from "@/lib/repeat";
import { drawTile, publishedFileName, scaleForDpi, tilePixels, type LoadedImages, type TileContext } from "./tile-canvas";

/**
 * Publish to Your library (spec F-S4 "Publish saves it to Your library"). The tile is drawn once at
 * print resolution and the PNG goes into the brand's own artwork library through the ordinary
 * artwork upload, which screens it first (X8 `screenUpload`, F-G1). So a published tile is held and
 * screened exactly like any other picture, and the Library toolbar finds it under Your library.
 *
 * The pictures already on the tile were screened when they were uploaded. The rights the brand
 * confirmed for them carry to the tile made from them, which is why publishing does not ask again.
 */

/** Knitwright's own default, labelled: the resolution the guardrails hold artwork to twice over. */
export const PUBLISH_DPI = 300;

/** What a browser gives us to draw on. Passed in, so publishing can be tested without a canvas. */
export interface DrawingSurface {
  readonly width: number;
  readonly height: number;
  context(): TileContext | null;
  png(): Promise<Blob | null>;
}

export type PublishOutcome =
  | Readonly<{ ok: true; artwork: UploadedArtwork; findings: readonly RepeatFinding[] }>
  | Readonly<{ ok: false; reason: string; findings: readonly RepeatFinding[] }>;

const CANNOT_DRAW = "This browser could not draw the tile. Try again, or use another browser.";

export interface PublishDeps {
  /** Makes a surface of the size asked for. */
  readonly surface: (width: number, height: number) => DrawingSurface;
  readonly images: LoadedImages;
  readonly send: (file: File) => Promise<Outcome<UploadedArtwork>>;
}

/**
 * Draws the tile and puts it in the library, or says why not. A blocked repeat is never drawn;
 * warnings are carried back so the panel keeps showing them.
 */
export async function publishRepeat(deps: PublishDeps, draft: RepeatDraft): Promise<PublishOutcome> {
  const ready = publishable(draft);
  if (!ready.ok) return { ok: false, reason: "This repeat is not ready to publish yet.", findings: ready.findings };

  const size = tilePixels(draft, PUBLISH_DPI);
  const surface = deps.surface(size.width, size.height);
  const context = surface.context();
  if (!context) return { ok: false, reason: CANNOT_DRAW, findings: ready.findings };
  drawTile(context, draft, scaleForDpi(PUBLISH_DPI), deps.images);

  const png = await surface.png();
  if (!png) return { ok: false, reason: CANNOT_DRAW, findings: ready.findings };
  const file = new File([png], publishedFileName(draft), { type: "image/png" });
  const sent = await deps.send(file);
  return sent.ok ? { ok: true, artwork: sent.data, findings: ready.findings } : { ok: false, reason: sent.reason, findings: ready.findings };
}

/** The real surface and the real upload, used in the browser. */
export function browserDeps(images: LoadedImages): PublishDeps {
  return {
    images,
    surface: (width, height) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return {
        width,
        height,
        // A real context's fillStyle also takes a gradient or a pattern; the tile only ever sets a
        // colour, so the narrower TileContext is what the drawing is written against.
        context: () => canvas.getContext("2d") as TileContext | null,
        png: () => new Promise<Blob | null>((settle) => canvas.toBlob(settle, "image/png")),
      };
    },
    // The rights the brand confirmed for the pictures on the tile carry to the tile itself.
    send: (file) => uploadArtwork((input, init) => fetch(input, init), file, true),
  };
}

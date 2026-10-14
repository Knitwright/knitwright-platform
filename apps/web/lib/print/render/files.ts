import { createHash } from "node:crypto";
import type { PrintFormat } from "../formats";
import type { PieceScene } from "../layout/scene";
import { pageSizeMm, buildSvg } from "./svg";
import { buildPdf } from "./pdf";
import { slugOf } from "./slug";
import { buildTiff } from "./tiff";
import type { Font } from "../text/font";
import type { PrintSettings } from "../layout/context";

export const MIME_OF: Readonly<Record<PrintFormat, string>> = { pdf: "application/pdf", svg: "image/svg+xml", tiff: "image/tiff" };
export const EXTENSION_OF: Readonly<Record<PrintFormat, string>> = { pdf: "pdf", svg: "svg", tiff: "tif" };

export interface RenderedFile {
  readonly format: PrintFormat;
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly pageWidthMm: number;
  readonly pageHeightMm: number;
  readonly warnings: readonly string[];
}

export interface RenderEnv {
  readonly font: Font;
  readonly settings: Pick<PrintSettings, "iccBytes">;
  /** Draw the cut line and the bleed line. On unless a person turns it off. */
  readonly guides?: boolean;
  readonly stripBudget?: number;
}

export const sha256Of = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/**
 * One scene as one file. SVG is built here, when asked for, and handed on: it is never stored (an SVG can hold script, and
 * the exports bucket does not accept one). Every file carries its cut line, its bleed line and its notes.
 */
export async function renderFile(scene: PieceScene, format: PrintFormat, env: RenderEnv): Promise<RenderedFile> {
  const guides = env.guides ?? true;
  const slug = slugOf(env.font, scene.notes, scene.box, scene.bleedMm);
  let bytes: Uint8Array;
  if (format === "svg") bytes = new TextEncoder().encode(buildSvg(scene, { guides, slug: slug.shapes, background: null, description: scene.notes }));
  else if (format === "pdf") bytes = await buildPdf(scene, { guides, slug: slug.shapes });
  else bytes = await buildTiff(scene, { settings: env.settings, guides, slug: slug.shapes, ...(env.stripBudget === undefined ? {} : { stripBudget: env.stripBudget }) });
  const { widthMm, heightMm } = pageSizeMm(scene);
  return { format, bytes, sha256: sha256Of(bytes), pageWidthMm: widthMm, pageHeightMm: heightMm, warnings: scene.issues.map((i) => i.text) };
}

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { AppError } from "@/lib/server/core/errors";
import { withDeadline } from "../deadline";
import { NOTES, REFUSALS } from "../messages";
import { INTAKE_LIMITS, PDF_READ_DPI } from "../settings";
import { matte } from "./matte";
import { scanPdf } from "./scan";

/** One PDF page as pixels, with what was found and left out. */
export type PdfPage = Readonly<{
  png: Buffer;
  widthPx: number;
  heightPx: number;
  /** The resolution the page was drawn at. */
  dpi: number;
  pageSizeMm: Readonly<{ width: number; height: number }>;
  pageCount: number;
  notes: readonly string[];
}>;

const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;
/** The biggest page picture made, below the pixel cap so the later steps have room. */
const MAX_RENDER_PIXELS = 90_000_000;

type PdfDocument = {
  numPages: number;
  canvasFactory: { create: (w: number, h: number) => { canvas: { toBuffer: (type: string) => Buffer }; context: unknown } };
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: Record<string, unknown>) => { promise: Promise<void> };
    getAnnotations: () => Promise<{ subtype?: string; action?: unknown; url?: string; jsAction?: unknown; actions?: unknown }[]>;
  }>;
  getJSActions: () => Promise<Map<unknown, unknown> | null>;
  getAttachments: () => Promise<Map<unknown, unknown> | null>;
  destroy: () => Promise<void>;
};

const fontFolder = (): string => `${join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts")}/`;

const open = async (bytes: Uint8Array): Promise<{ document: PdfDocument; destroy: () => Promise<void> }> => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    // Nothing in the file may run: no scripts, no forms, no fonts from the system, no pictures over the cap.
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: false,
    standardFontDataUrl: fontFolder(),
    maxImageSize: MAX_RENDER_PIXELS,
    verbosity: 0,
  });
  try {
    return { document: (await task.promise) as unknown as PdfDocument, destroy: () => task.destroy() };
  } catch (error) {
    await task.destroy();
    const name = (error as { name?: string }).name;
    if (name === "PasswordException") throw new AppError("invalid_input", REFUSALS.pdfEncrypted);
    throw new AppError("invalid_input", REFUSALS.unreadable);
  }
};

/** Looks inside the open document for what the byte scan cannot see (compressed streams), and drops it. */
const inspect = async (document: PdfDocument, page: Awaited<ReturnType<PdfDocument["getPage"]>>): Promise<{ script: boolean; dropped: Set<string> }> => {
  const dropped = new Set<string>();
  const documentScripts = await document.getJSActions();
  const attachments = await document.getAttachments();
  if (attachments && attachments.size > 0) dropped.add("embedded files");
  const annotations = await page.getAnnotations();
  const script = (documentScripts?.size ?? 0) > 0 || annotations.some((a) => a.jsAction !== undefined || (a.actions && Object.keys(a.actions).length > 0));
  if (annotations.some((a) => a.url !== undefined)) dropped.add("web links");
  if (annotations.some((a) => a.action !== undefined)) dropped.add("actions");
  return { script, dropped };
};

export const scaleFor = (widthPt: number, heightPt: number): number => {
  const wanted = PDF_READ_DPI / POINTS_PER_INCH;
  const byEdge = INTAKE_LIMITS.maxEdgePx / Math.max(widthPt, heightPt);
  const byPixels = Math.sqrt(MAX_RENDER_PIXELS / (widthPt * heightPt));
  return Math.min(wanted, byEdge, byPixels);
};

const draw = async (bytes: Uint8Array): Promise<PdfPage> => {
  const found = scanPdf(bytes);
  if (found.script) throw new AppError("invalid_input", REFUSALS.pdfScript);
  const { document, destroy } = await open(bytes);
  try {
    if (document.numPages < 1) throw new AppError("invalid_input", REFUSALS.pdfNoPages);
    const page = await document.getPage(1);
    const inside = await inspect(document, page);
    if (inside.script) throw new AppError("invalid_input", REFUSALS.pdfScript);
    const base = page.getViewport({ scale: 1 });
    if (!(base.width > 0 && base.height > 0)) throw new AppError("invalid_input", REFUSALS.unreadable);
    const scale = scaleFor(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const widthPx = Math.max(1, Math.floor(viewport.width));
    const heightPx = Math.max(1, Math.floor(viewport.height));
    // Annotations (links, form fields) are not drawn: annotationMode 0. The page is drawn on white and on black
    // so the empty part of the page can be see-through, as the art on it would print.
    const drawOn = async (background: string): Promise<Buffer> => {
      const { canvas, context } = document.canvasFactory.create(widthPx, heightPx);
      await page.render({ canvasContext: context, canvas, viewport, annotationMode: 0, background }).promise;
      return canvas.toBuffer("image/png");
    };
    const png = await matte(await drawOn("#ffffff"), await drawOn("#000000"));
    const dropped = [...new Set([...found.dropped, ...inside.dropped])].sort();
    const notes = [
      ...(document.numPages > 1 ? [NOTES.firstPage] : []),
      ...(dropped.length > 0 ? [`The PDF contained ${dropped.join(", ")}. They were left out.`] : []),
      NOTES.spotColours,
    ];
    return {
      png,
      widthPx,
      heightPx,
      dpi: Math.round(scale * POINTS_PER_INCH),
      pageSizeMm: { width: (base.width / POINTS_PER_INCH) * MM_PER_INCH, height: (base.height / POINTS_PER_INCH) * MM_PER_INCH },
      pageCount: document.numPages,
      notes,
    };
  } catch (error) {
    throw error instanceof AppError ? error : new AppError("invalid_input", REFUSALS.unreadable);
  } finally {
    await destroy();
  }
};

/**
 * Draws the first page of a PDF as pixels. A PDF with script is refused; embedded files and actions are left
 * out; spot colours become screen colours. Nothing from the file is kept except what is drawn.
 */
export const rasterisePdf = (bytes: Uint8Array): Promise<PdfPage> => withDeadline(draw(bytes), INTAKE_LIMITS.maxReadMs);

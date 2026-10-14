import { AppError } from "@/lib/server/core/errors";

/** A vector file that cannot be accepted. The message says what was found, in plain words. */
export const refuse = (message: string): never => {
  throw new AppError("invalid_input", message);
};

export const REFUSALS = {
  script: "This SVG contains a script, so it was not accepted. Nothing was kept. Export a plain SVG without scripts, or a PDF.",
  eventHandler: (name: string) =>
    `This SVG has an event handler (${name.slice(0, 20)}) that could run code, so it was not accepted. Nothing was kept. Export a plain SVG, or a PDF.`,
  foreignObject: "This SVG embeds web page content (foreignObject), so it was not accepted. Nothing was kept. Export a plain SVG, or a PDF.",
  embeddedContent: "This SVG embeds other content (a frame, object or media), so it was not accepted. Nothing was kept. Export a plain SVG, or a PDF.",
  animation: "This SVG is animated. A print file cannot be, so it was not accepted. Export a still SVG, or a PDF.",
  external: "This SVG refers to something outside the file, so it was not accepted. Nothing was kept. Export it again with everything inside the file, or as a PDF.",
  entities:
    "This SVG defines entities, which can make a small file expand into a huge one, so it was not accepted. Nothing was kept. Export a plain SVG, or a PDF.",
  notXml: "That file could not be read as an SVG. Export it again from your design app, or use a PDF.",
  notUtf8: "That SVG is not saved as UTF-8 text. Export it again as plain UTF-8 SVG, or as a PDF.",
  notSvg: "That file is not an SVG picture. Export it again from your design app, or use a PDF.",
  empty: "That SVG has no size or nothing to draw. Check the file in your design app and export it again.",
  tooBig: (kb: number) => `That vector file is too large (over ${kb} KB). Simplify it in your design app, or use a PDF or a PNG.`,
  tooComplex: "That vector file is too complex: it has too many shapes or points. Simplify it in your design app, or use a PNG.",
  tooSlow: "That vector file took too long to read. Simplify it in your design app, or use a PNG.",
  tooDeep: "That vector file nests its parts too deeply. Simplify it in your design app, or use a PNG.",
} as const;

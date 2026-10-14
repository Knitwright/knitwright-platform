/** The sentences a person sees when a file is refused. Plain words: what was found, and what to do. */
export const REFUSALS = {
  notAccepted: "Upload a PNG, JPEG, TIFF, PDF or SVG file.",
  unreadable: "That file could not be read as a picture.",
  tooBig: "Artwork files can be 50 MB at most.",
  tooManyPixels: "That picture is too large. Use one under 100 megapixels and 12 000 pixels on the longest side.",
  nativeAi:
    "That is an Illustrator file without a PDF inside. Save it from Illustrator with 'Create PDF compatible file', or export a PDF or SVG.",
  rightsMissing: "Tick the box to confirm you own this artwork or have permission to use it on garments. Nothing was uploaded.",
  busy: "Your other artwork is still being read. Try again in a moment.",
  tooSlow: "That file took too long to read. Try a simpler or smaller file.",
  pdfScript: "That PDF contains a script, so it was not accepted. Export it again as a plain PDF or SVG.",
  pdfEncrypted: "That PDF is locked with a password. Export an unlocked copy and try again.",
  pdfNoPages: "That PDF has no pages.",
  svgTooBig: "That SVG is too big or too complicated. Simplify it, or export a PNG.",
  svgNotSvg: "That file is not a valid SVG.",
  svgEmpty: "That SVG has nothing to draw.",
  noSuchArtwork: "That artwork does not exist.",
  notATile: "Only a picture can be made seamless.",
  printCopyTooBig: "That picture is too large to keep at full size. Use a smaller version of it.",
  convertTooBig: "That picture is too large to change here. Use a smaller version of it.",
  nothingToRemove: "There is no white background to remove.",
} as const;

/** Why an SVG was refused: what was found. Nothing was stored. */
export const SVG_REFUSALS = {
  script: "That SVG contains a script, so it was not accepted. Nothing was stored.",
  eventHandler: "That SVG contains an event handler (such as onload), so it was not accepted. Nothing was stored.",
  foreignObject: "That SVG embeds other content (foreignObject), so it was not accepted. Nothing was stored.",
  externalReference:
    "That SVG points to something outside the file (a web address or another file), so it was not accepted. Nothing was stored.",
  stylesheetImport: "That SVG imports a stylesheet, so it was not accepted. Nothing was stored.",
  entities: "That SVG declares entities or a document type, so it was not accepted. Nothing was stored.",
  badUse: "That SVG reuses a shape from outside the file, so it was not accepted. Nothing was stored.",
  animation: "That SVG is animated, so it was not accepted. Nothing was stored.",
  tooComplex: "That SVG is too big or too complicated. Simplify it, or export a PNG. Nothing was stored.",
  malformed: "That SVG could not be read. Export it again, or use a PNG. Nothing was stored.",
} as const;

export type SvgRefusal = keyof typeof SVG_REFUSALS;

/** Plain notes added to a result when colour or pages were handled. */
export const NOTES = {
  noProfile: "No colour profile was embedded, so the colours were taken as sRGB.",
  cmykNoProfile: "This CMYK picture had no colour profile, so a standard conversion to screen colours was used. Colours may shift.",
  profileUsed: (name: string) => `Colours were converted to sRGB using the embedded profile "${name}".`,
  profileUnnamed: "Colours were converted to sRGB using the embedded profile.",
  sixteenBit: "The picture had more than 8 bits per colour; it was reduced to 8.",
  firstPage: "Only the first page of the file was used.",
  spotColours: "Spot colours were turned into screen colours.",
  whiteBox: "This picture sits on a white box. Sublimation prints no white ink, so the white will be the fabric's own colour.",
  keptAlpha: "See-through parts of the picture were kept.",
} as const;

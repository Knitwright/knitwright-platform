import type { PrintFormat } from "./formats";

export const ZONE_WORDS: Readonly<Record<string, string>> = {
  crest: "Crest",
  sponsor: "Sponsor",
  "front-number": "Front number",
  "back-name": "Name",
  "back-number": "Back number",
  "sleeve-badge": "Sleeve badge",
  "sleeve-band": "Sleeve band",
};

export const FORMAT_WORDS: Readonly<Record<PrintFormat, string>> = { pdf: "PDF (1:1, for most print houses)", svg: "SVG (shapes you can edit)", tiff: "TIFF (pixels at the print resolution)" };

export interface DownloadChoice {
  readonly sizes: readonly string[];
  readonly formats: readonly PrintFormat[];
  readonly colourway?: string;
  readonly guides?: boolean;
}

/** The address that builds the zip for a choice. Everything is in the address, so a download is a plain link. */
export function downloadAddress(projectId: string, choice: DownloadChoice): string {
  const query = new URLSearchParams();
  if (choice.sizes.length > 0) query.set("sizes", choice.sizes.join(","));
  query.set("format", (choice.formats.length === 0 ? ["pdf"] : choice.formats).join(","));
  if (choice.colourway !== undefined) query.set("colourway", choice.colourway);
  if (choice.guides === false) query.set("guides", "off");
  return `/api/projects/${encodeURIComponent(projectId)}/print-files?${query.toString()}`;
}

export interface Frame {
  readonly viewBox: string;
  readonly width: number;
  readonly height: number;
}

type Pt = readonly [number, number];

/** The box to draw a piece in, with the pattern file's y axis turned to point up the page, and a little room all round. */
export function pieceFrame(outline: readonly Pt[], room = 10): Frame {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => -p[1]);
  const [x0, y0] = [Math.min(...xs) - room, Math.min(...ys) - room];
  const [width, height] = [Math.max(...xs) + room - x0, Math.max(...ys) + room - y0];
  return { viewBox: `${x0} ${y0} ${width} ${height}`, width, height };
}

/** Points of a polygon as an SVG points list, with the y axis turned to match `pieceFrame`. */
export const pointsText = (polygon: readonly Pt[]): string => polygon.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(-y * 100) / 100}`).join(" ");

export const zoneWords = (purpose: string): string => ZONE_WORDS[purpose] ?? purpose.replaceAll("-", " ");

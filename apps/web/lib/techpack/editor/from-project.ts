import type { BaseArticle } from "@/lib/catalogue";
import type { GarmentSpec } from "@/lib/garment";
import { marksOf } from "../view/marks";
import { buildTechPackView, type TechPackView } from "../view/model";
import type { OverviewHeader } from "../view/overview";
import type { LengthUnit } from "../view/units";
import { buildSheets, type TechPackSheets } from "./sheets";

/**
 * The tech pack editor's inputs read off a stored design, so the page, the sheets preview and the
 * eight-sheet download are all made by one call from the same reads (decision 0151).
 */

export type StoredDesign = Readonly<{ name: string; season: string; spec: GarmentSpec }>;

/** The header a stored design can fill: its name, the brand's name and its season. The rest is asked for. */
export const headerOfDesign = (design: StoredDesign, brandName: string): OverviewHeader => ({
  styleName: design.name.trim() === "" ? null : design.name,
  formName: null,
  brand: brandName.trim() === "" ? null : brandName,
  collection: null,
  season: design.season.trim() === "" ? null : design.season,
  // The factory is Knitwright QC's to set (🔒), so nothing fills it from the design.
  factory: null,
});

export type DesignViewInput = Readonly<{
  design: StoredDesign;
  brandName: string;
  article: BaseArticle | null;
  unit?: LengthUnit;
  size?: string;
  colourwayId?: string;
}>;

export function viewOfDesign(input: DesignViewInput): TechPackView {
  const { design, article } = input;
  const sizes = article?.sizeRange ?? [];
  return buildTechPackView({
    spec: design.spec,
    article,
    header: headerOfDesign(design, input.brandName),
    size: input.size ?? article?.sampleSize ?? sizes[0] ?? "",
    sizes,
    colourwayId: input.colourwayId ?? design.spec.colourways[0]?.id ?? "",
    marks: marksOf(design.spec),
    extras: [],
    unit: input.unit ?? "cm",
    mode: "measurement",
  });
}

/** "13 Nov 2026", the way the sheets' header writes a day. Always in UTC, so a server writes one day. */
export const sheetDate = (now: Date): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(now);

/** The tech pack editor's own address, the sheets' "Open in Knitwright". */
export const editorAddress = (siteUrl: string, projectId: string): string => `${siteUrl.replace(/\/+$/, "")}/studio/${projectId}/tech-pack`;

export function sheetsOfDesign(input: DesignViewInput & Readonly<{ now: Date; openIn: string }>): TechPackSheets {
  return buildSheets({
    view: viewOfDesign(input),
    header: headerOfDesign(input.design, input.brandName),
    article: input.article,
    date: sheetDate(input.now),
    openIn: input.openIn,
  });
}

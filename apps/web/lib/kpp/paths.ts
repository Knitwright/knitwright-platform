/**
 * The package layout of docs/spec/04-production-package.md, as paths inside the ZIP. Every name a
 * person typed is made safe for a file name first: letters, digits, dot, hyphen and underscore.
 */

/** A name part safe in a path: no slash, no "..", no leading dot, at most 60 characters. */
export const safePart = (text: string, fallback = "x"): string =>
  text
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^[._]+|_+$/g, "")
    .slice(0, 60) || fallback;

/** The root folder: `KPP_<designCode>_v<version>_<factoryCode>`. */
export const packageRoot = (designCode: string, version: number, factoryCode: string): string =>
  `KPP_${safePart(designCode, "design")}_v${version}_${safePart(factoryCode, "factory")}`;

export const PATHS = {
  manifest: "manifest.json",
  readme: "00_README.pdf",
  jobSheet: "job_sheet.pdf",
  techpackPdf: "01_techpack/techpack.pdf",
  techpackJson: "01_techpack/techpack.json",
  pom: "02_measurements/pom.csv",
  sizeChart: "02_measurements/size_chart_customer.pdf",
  colourPdf: "05_colour/colour_spec.pdf",
  colourJson: "05_colour/colour_spec.json",
  bom: "06_bom/bom.csv",
  brandLabel: "07_labels/brand_label.pdf",
  names: "08_personalisation/names_numbers.csv",
  qc: "09_qc/qc_checklist.pdf",
  renders: "10_reference/renders_front_back.pdf",
  golden: "10_reference/golden_sample.pdf",
} as const;

export const dxfPath = (article: string, size: string): string => `03_patterns/dxf_aama/${safePart(article)}_${safePart(size)}.dxf`;
export const nestPath = (article: string): string => `03_patterns/dxf_aama/${safePart(article)}_nest.dxf`;
export const pdf1to1Path = (article: string, size: string): string => `03_patterns/pdf_1to1/${safePart(article)}_${safePart(size)}.pdf`;
export const svgPath = (article: string, size: string): string => `03_patterns/svg/${safePart(article)}_${safePart(size)}.svg`;
export const careLabelPath = (market: string): string => `07_labels/care_label_${safePart(market.toLowerCase())}.pdf`;

/**
 * A print file. Sample packages: `04_print/<size>/SAMPLE_<article>_<panel>_<size>.<ext>`.
 * Batch packages group by order: `04_print/<orderNo>/<size>/<orderNo>_<article>_<panel>_<size>.<ext>`.
 */
export function printPath(article: string, panel: string, size: string, ext: string, orderNo: string | null): string {
  const s = safePart(size);
  const file = `${safePart(orderNo ?? "SAMPLE")}_${safePart(article)}_${safePart(panel)}_${s}.${ext}`;
  return orderNo === null ? `04_print/${s}/${file}` : `04_print/${safePart(orderNo)}/${s}/${file}`;
}

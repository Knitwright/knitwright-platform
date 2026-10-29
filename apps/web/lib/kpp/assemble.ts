import { zipSync, type Zippable } from "fflate";
import type { GradedPattern } from "@/lib/production/contract";
import { sha256Hex, stableJson, utf8 } from "./encode";
import { careLabelPdf, colourSpecPdf, jobSheetPdf, qcPdf, readmePdf, sizeChartPdf } from "./files/documents";
import { dxfForSize, nestDxf, patternSvg, pdf1to1, type PatternFileOptions } from "./files/patterns";
import { rendersPdf } from "./files/reference";
import { bomCsv, colourJson, namesCsv, pomCsv, techpackJson } from "./files/tables";
import { checkPackage, type GateIssue } from "./gate";
import { GAP_RULE, type KppInput, type KppSources } from "./model";
import { careLabelPath, dxfPath, nestPath, packageRoot, PATHS, pdf1to1Path, printPath, svgPath } from "./paths";
import { pinPdf } from "./pdf/pin";

/** Bumped whenever a generator's output changes, so a manifest says which code made its files. */
export const KPP_GENERATOR_VERSION = "kpp-1.0.0";

export interface PackageFile {
  readonly path: string;
  readonly bytes: Uint8Array;
  /** The code that made the file. */
  readonly generator: string;
}

export interface ManifestEntry {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly generator: string;
}

export type BuildResult =
  | Readonly<{ ok: true; root: string; zip: Uint8Array; files: readonly ManifestEntry[] }>
  | Readonly<{ ok: false; issues: readonly GateIssue[] }>;

const KPP = "lib/kpp";

function patternIssues(input: KppInput, pattern: GradedPattern): GateIssue[] {
  const missing = input.design.sizes.filter((s) => !Object.hasOwn(pattern.piecesBySize, s));
  return missing.length > 0 ? [{ path: "pattern", message: `Pattern: no pieces for size ${missing.join(", ")}.`, ruleId: GAP_RULE }] : [];
}

function patternFiles(input: KppInput, pattern: GradedPattern): PackageFile[] {
  const options: PatternFileOptions = {
    article: input.design.articleCode,
    styleName: input.design.code,
    notch: input.factory.notch,
    status: `Graded pattern ${pattern.blockId} v${pattern.blockVersion}`,
    createdIso: input.design.createdAtIso,
  };
  const article = input.design.articleCode;
  const perSize = input.design.sizes.flatMap((size) => {
    const pieces = pattern.piecesBySize[size];
    return [
      { path: dxfPath(article, size), bytes: utf8(dxfForSize(pieces, options)), generator: "lib/pattern-library/dxf" },
      { path: pdf1to1Path(article, size), bytes: pdf1to1(pieces, options), generator: KPP },
      { path: svgPath(article, size), bytes: utf8(patternSvg(pieces, options)), generator: KPP },
    ];
  });
  const nest = { ...pattern, sizes: [...input.design.sizes], piecesBySize: Object.fromEntries(input.design.sizes.map((s) => [s, pattern.piecesBySize[s]])) };
  return [...perSize, { path: nestPath(article), bytes: utf8(nestDxf(nest, options)), generator: "lib/pattern-library/dxf" }];
}

async function printFiles(input: KppInput, sources: KppSources): Promise<PackageFile[]> {
  const ext = input.factory.printFileType;
  const runs: { size: string; orderNo: string | null }[] =
    input.kind === "batch"
      ? [...input.orders].sort((a, b) => (a.orderNo < b.orderNo ? -1 : 1)).flatMap((o) => input.design.sizes.filter((s) => (o.sizes[s] ?? 0) > 0).map((size) => ({ size, orderNo: o.orderNo })))
      : input.design.sizes.map((size) => ({ size, orderNo: null }));
  const out: PackageFile[] = [];
  for (const run of runs) {
    for (const file of await sources.print.files(run.size, run.orderNo)) {
      const bytes = ext === "pdf" ? pinPdf(file.bytes, input.design.createdAtIso) : file.bytes;
      out.push({ path: printPath(input.design.articleCode, file.panel, run.size, ext, run.orderNo), bytes, generator: "lib/print" });
    }
  }
  return out;
}

function documentFiles(input: KppInput, sources: KppSources): PackageFile[] {
  const files: PackageFile[] = [
    { path: PATHS.techpackJson, bytes: utf8(techpackJson(input)), generator: KPP },
    { path: PATHS.pom, bytes: utf8(pomCsv(input)), generator: KPP },
    { path: PATHS.sizeChart, bytes: sizeChartPdf(input), generator: KPP },
    { path: PATHS.colourPdf, bytes: colourSpecPdf(input), generator: KPP },
    { path: PATHS.colourJson, bytes: utf8(colourJson(input)), generator: KPP },
    { path: PATHS.bom, bytes: utf8(bomCsv(input)), generator: KPP },
    ...input.labels.map((label) => ({ path: careLabelPath(label.market), bytes: careLabelPdf(input, label), generator: KPP })),
    { path: PATHS.qc, bytes: qcPdf(input), generator: KPP },
  ];
  if (sources.brandLabelPdf) files.push({ path: PATHS.brandLabel, bytes: pinPdf(sources.brandLabelPdf, input.design.createdAtIso), generator: "brand upload" });
  if (sources.goldenSamplePdf) files.push({ path: PATHS.golden, bytes: pinPdf(sources.goldenSamplePdf, input.design.createdAtIso), generator: "golden sample" });
  if (input.kind === "batch") {
    files.push({ path: PATHS.names, bytes: utf8(namesCsv(input)), generator: KPP }, { path: PATHS.jobSheet, bytes: jobSheetPdf(input), generator: KPP });
  }
  return files;
}

/** A ZIP entry time: the version's creation time, never before 1980 (the earliest a ZIP can hold). */
const zipTime = (iso: string): Date => new Date(Math.max(Date.parse(iso), Date.UTC(1980, 0, 2)));

export function manifestOf(input: KppInput, root: string, files: readonly PackageFile[]): { entries: ManifestEntry[]; json: string } {
  const entries = [...files].sort((a, b) => (a.path < b.path ? -1 : 1)).map((f) => ({ path: f.path, sha256: sha256Hex(f.bytes), bytes: f.bytes.length, generator: f.generator }));
  const d = input.design;
  const json = stableJson({
    package: root,
    kind: input.kind,
    design: { code: d.code, article: d.articleCode, version: d.version, hash: d.hash },
    factory: { code: input.factory.code, name: input.factory.name },
    generator: { name: "knitwright-kpp", version: KPP_GENERATOR_VERSION },
    created: d.createdAtIso,
    files: entries,
  });
  return { entries, json };
}

function zip(root: string, files: readonly PackageFile[], createdIso: string): Uint8Array {
  const mtime = zipTime(createdIso);
  const tree: Zippable = {};
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const key = `${root}/${f.path}`;
    // Two files with one path would silently lose one; that is a bug in the input, so it stops the build.
    if (Object.hasOwn(tree, key)) throw new Error(`Two package files share the path ${f.path}.`);
    tree[key] = [f.bytes, { level: 6, mtime }];
  }
  return zipSync(tree);
}

/**
 * Builds the production package: checks it (F-G2), makes every file, writes the manifest and
 * zips it. The same input and sources give the same bytes: nothing reads the clock, every PDF
 * date is the version's creation time, and the files are zipped in path order.
 */
export async function buildPackage(input: KppInput, sources: KppSources): Promise<BuildResult> {
  const issues = checkPackage(input);
  if (issues.length > 0) return { ok: false, issues };
  const pattern = await sources.pattern.pattern();
  const missing = patternIssues(input, pattern);
  if (missing.length > 0) return { ok: false, issues: missing };
  const root = packageRoot(input.design.code, input.design.version, input.factory.code);
  const created = input.design.createdAtIso;
  const body: PackageFile[] = [
    { path: PATHS.techpackPdf, bytes: pinPdf(await sources.techpack.pdf(), created), generator: "lib/techpack/exports/pdf" },
    ...documentFiles(input, sources),
    ...patternFiles(input, pattern),
    ...(await printFiles(input, sources)),
    { path: PATHS.renders, bytes: rendersPdf(input, await sources.renders.frontBack()), generator: KPP },
  ];
  const withReadme = [...body, { path: PATHS.readme, bytes: readmePdf(input, body.map((f) => f.path)), generator: KPP }];
  const { entries, json } = manifestOf(input, root, withReadme);
  const all = [...withReadme, { path: PATHS.manifest, bytes: utf8(json), generator: KPP }];
  return { ok: true, root, zip: zip(root, all, created), files: entries };
}

import { hexToLab } from "../encode";
import { packageWarnings } from "../gate";
import type { KppInput, KppLabel } from "../model";
import { Canvas, wrapText } from "../pdf/canvas";
import { FlowDoc } from "../pdf/flow";
import { writePdf } from "../pdf/writer";

/** The package's own PDF documents, written with the package's PDF writer so their bytes are fixed. */

const header = (input: KppInput): string => {
  const d = input.design;
  return [d.brand, d.name, d.code, d.season ?? "Season not set", `Base size ${d.baseSize}`, `Version ${d.version}`].join("  |  ");
};

export const flow = (input: KppInput, title: string, landscape = false): FlowDoc =>
  new FlowDoc({ title: `${input.design.code} v${input.design.version}: ${title}`, createdIso: input.design.createdAtIso, landscape, header: header(input), footer: input.design.code });

/** How many files sit in each top folder, for the README. */
export function folderCounts(paths: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const top = path.includes("/") ? path.slice(0, path.indexOf("/")) : path;
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([top, n]) => (top.includes(".") ? top : `${top}/: ${n} file${n === 1 ? "" : "s"}`));
}

export function readmePdf(input: KppInput, paths: readonly string[]): Uint8Array {
  const f = input.factory;
  const doc = flow(input, "README")
    .heading(`Production package: ${input.design.name}`)
    .paragraph(`${input.kind === "batch" ? "Production batch" : "Sample"} package for ${f.name} (${f.code}). Design ${input.design.code}, version ${input.design.version}, article ${input.design.articleCode}. Sizes ${input.design.sizes.join(", ")}, base size ${input.design.baseSize}.`)
    .paragraph(`Due date: ${input.dueDate ?? "not set"}.`, { bold: true })
    .paragraph(`Who to contact: ${f.contact ?? "Knitwright production team"}.`)
    .heading("What is inside", 11)
    .bullets(folderCounts(paths))
    .heading("Read before you start", 11)
    .bullets([
      "Print files are NOT mirrored. Your RIP mirrors them for transfer paper.",
      `Print files: ${input.print.dpi} DPI at 1:1, ${input.print.bleedMm} mm bleed beyond the cut line, sRGB.`,
      `Notches are marked for ${f.notch === "slit" ? "slit" : "V-notch"} cutting.`,
      "manifest.json lists every file with its SHA-256. A file whose hash differs is not from this package: ask Knitwright.",
      "Every value comes from the design version named above. Nothing in this package was edited by hand.",
      ...packageWarnings(input),
      ...input.notes,
    ]);
  return doc.build();
}

export function sizeChartPdf(input: KppInput): Uint8Array {
  const sizes = input.design.sizes;
  const share = 0.4 / Math.max(sizes.length, 1);
  const columns = [{ title: "Measurement (garment, mm)", share: 0.6 }, ...sizes.map((s) => ({ title: s === input.design.baseSize ? `${s} (base)` : s, share }))];
  const rows = input.poms.map((p) => [`${p.letter} ${p.description}`, ...sizes.map((s) => (p.values[s] === null || p.values[s] === undefined ? "" : String(p.values[s])))]);
  return flow(input, "Size chart", true)
    .heading("Garment measurements")
    .paragraph("These are measurements of the finished garment, not of the body. Half measurements are across the garment laid flat.", { muted: true })
    .table(columns, rows)
    .build();
}

export function colourSpecPdf(input: KppInput): Uint8Array {
  const c = input.colour;
  const rows = c.colours.map((k) => [k.role, k.hex ?? "", k.hex ? hexToLab(k.hex).join(", ") : "", k.pantoneTcx ?? "", k.swatchId ?? ""]);
  return flow(input, "Colour spec")
    .heading("Colour spec")
    .paragraph(`Fabric: ${c.fabric ?? "not set"}. Tolerance: delta E CMC 2:1 <= ${c.tolerance.max} against the strike-off. Strike-off required: ${c.strikeOffRequired ? "yes" : "no"}. Rule ${c.ruleId}.`)
    .table(
      [
        { title: "Role", share: 0.2 },
        { title: "Hex", share: 0.14 },
        { title: "Lab (from hex, D65)", share: 0.24 },
        { title: "Pantone TCX", share: 0.2 },
        { title: "Swatch ID", share: 0.22 },
      ],
      rows,
    )
    .paragraph("Lab is computed from the screen colour. The printed strike-off is the colour to match.", { muted: true })
    .build();
}

const LABEL_W = 60;
const LABEL_H = 100;

/** One care label at 1:1 (60 x 100 mm), for one destination market. */
export function careLabelPdf(input: KppInput, label: KppLabel): Uint8Array {
  const c = new Canvas(LABEL_W, LABEL_H);
  c.rect(1, 1, LABEL_W - 2, LABEL_H - 2, { widthPt: 0.3, dash: [1, 1] });
  const lines = [label.fibre ?? "", ...label.care, label.origin ?? "", `Size ${label.size ?? ""}`, ...(label.importer ? [label.importer] : [])];
  let y = 8;
  for (const line of lines) {
    for (const part of wrapText(line, LABEL_W - 8, 7)) {
      c.text(4, y, part, { size: 7 });
      y += 3.4;
    }
    y += 1.2;
  }
  c.text(4, LABEL_H - 4, `${label.market.toUpperCase()}  ${input.design.code}  ${label.ruleId}`, { size: 5, grey: 0.4 });
  return writePdf({ title: `${input.design.code} care label ${label.market.toUpperCase()}`, createdIso: input.design.createdAtIso, pages: [c.page()] });
}

export function qcPdf(input: KppInput): Uint8Array {
  const measured = input.poms.filter((p) => input.qc.measure.includes(p.letter));
  const rows = measured.map((p) => [p.letter, p.description, `-${p.tolMinusMm ?? "?"} / +${p.tolPlusMm ?? "?"}`, input.design.sizes.map((s) => `${s} ${p.values[s] ?? "?"}`).join("  ")]);
  const sampling = input.factory.madeByKnitwright && input.kind === "sample" ? "Sample: inspect every piece." : input.qc.aqlPlan;
  return flow(input, "QC checklist", true)
    .heading("QC checklist")
    .paragraph(`Sampling: ${sampling}. Rule ${input.qc.ruleId}.`)
    .heading("Points of measure", 11)
    .table([{ title: "POM", share: 0.06 }, { title: "Description", share: 0.34 }, { title: "Tolerance mm", share: 0.12 }, { title: "Target per size (mm)", share: 0.48 }], rows)
    .heading("Colour", 11)
    .paragraph(input.qc.colour)
    .heading("Placement and personalisation", 11)
    .bullets(["Artwork placement matches the print placement page of the tech pack.", ...(input.kind === "batch" ? ["Names and numbers match 08_personalisation/names_numbers.csv."] : []), ...input.qc.visual])
    .heading("Photos to take", 11)
    .bullets(input.qc.photos)
    .build();
}

export function jobSheetPdf(input: KppInput): Uint8Array {
  const sizes = input.design.sizes;
  const share = 0.6 / Math.max(sizes.length + 1, 1);
  const total = (counts: Readonly<Record<string, number>>) => sizes.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const rows = input.orders.map((o) => [o.orderNo, o.dueDate ?? "not set", ...sizes.map((s) => String(o.sizes[s] ?? 0)), String(total(o.sizes))]);
  const sums = sizes.map((s) => input.orders.reduce((n, o) => n + (o.sizes[s] ?? 0), 0));
  return flow(input, "Job sheet", true)
    .heading(`Job sheet: ${input.design.articleCode}`)
    .paragraph(`Due date: ${input.dueDate ?? "not set"}. Factory: ${input.factory.name}.`, { bold: true })
    .table(
      [{ title: "Order", share: 0.24 }, { title: "Due", share: 0.16 }, ...sizes.map((s) => ({ title: s, share })), { title: "Total", share }],
      [...rows, ["All orders", "", ...sums.map(String), String(sums.reduce((a, b) => a + b, 0))]],
    )
    .heading("Packing", 11)
    .bullets(input.packing.length > 0 ? input.packing : ["Packing instructions not set."])
    .build();
}

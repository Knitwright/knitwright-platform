import { Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import type { ImageMap } from "@/lib/flat/images";
import type { FlatModel } from "@/lib/flat/model";
import { PDF_FONT_FAMILY } from "@/lib/flat/pdf-font";
import { renderPdf } from "@/lib/flat/render-pdf";
import type { FlatViewSection, SectionId, TechPack } from "../../types";
import { PICTURE_LEFT_OUT } from "../limits";
import type { PageBlock } from "../pages";
import type { ExportSection, ExportTable } from "../tables";
import { keepsSectionWhole, keepsTableWhole } from "./keep";
import type { SourceMarks } from "./marks";
import { dataTable, heading, paragraph, type Safe } from "./parts";
import { COLOURS, CONTENT_WIDTH, SIZES } from "./styles";

export interface Context {
  readonly pack: TechPack;
  readonly images: ImageMap;
  readonly safe: Safe;
  /** True when a picture was left out for size, so the document says so in words. */
  readonly pictureLeftOut: boolean;
  /** The mark printed after each value for its source. */
  readonly marks: SourceMarks;
}

const DRAWING_GAP = 16;
const DRAWING_WIDTH = (CONTENT_WIDTH - DRAWING_GAP) / 2;

/** The sections whose pictures may have been left out for size, so the page says so. */
export const PICTURE_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>(["flats", "artwork"]);

/** The drawing with the text in it made safe for the font. The drawing it is given is not changed. */
function withSafeText(model: FlatModel, safe: Safe): FlatModel {
  return {
    ...model,
    layers: model.layers.map((layer) => ({
      ...layer,
      elements: layer.elements.map((element) => (element.kind === "text" ? { ...element, text: safe(element.text) } : element)),
    })),
  };
}

const small = (text: string, key: string, safe: Safe): ReactElement =>
  h(Text, { key, style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.cell, color: COLOURS.muted, marginTop: 3 } }, safe(text));

function drawing(view: FlatViewSection, context: Context): ReactElement {
  const { safe, images } = context;
  return h(
    View,
    { key: view.view, wrap: false, style: { width: DRAWING_WIDTH } },
    small(view.label, "label", safe),
    view.model
      ? renderPdf(withSafeText(view.model, safe), { widthPoints: DRAWING_WIDTH, images })
      : h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.body, color: COLOURS.warn } }, safe(view.notice ?? "")),
    ...(view.model && view.notice ? [small(view.notice, "notice", safe)] : []),
  );
}

/** A row of drawings, two to a row, each whole on its page (owner decision 2026-09-30). */
export const drawingRow = (key: string, views: readonly FlatViewSection[], context: Context): ReactElement =>
  h(
    View,
    { key, style: { flexDirection: "row", flexWrap: "wrap", gap: DRAWING_GAP, marginVertical: 6 } },
    ...views.map((view, index) => h(View, { key: `${key}-${index}`, wrap: false }, drawing(view, context))),
  );

/** A table with its heading and sentence. A short table is not split across pages. */
export function tableGroup(table: ExportTable, index: number, safe: Safe, marks: SourceMarks): ReactElement {
  return h(
    View,
    { key: `t${index}`, wrap: !keepsTableWhole(table) },
    ...(table.title === null ? [] : [heading(3, table.title, safe)]),
    ...(table.intro === null ? [] : [paragraph(table.intro, safe, `i${index}`)]),
    ...(table.rows.length === 0 ? [] : [dataTable(table, safe, marks)]),
  );
}

/** A block as a section, so the height estimate of `keep.ts` can be read for it. */
const asSection = (block: PageBlock): ExportSection => ({
  id: block.sectionId,
  title: block.title,
  sheet: null,
  paragraphs: block.paragraphs,
  tables: block.tables,
});

/**
 * One section's share of a page: its title, its sentences, then its tables. The title and the
 * first sentence are kept together, so a heading is never left alone at the foot of a page.
 */
export function blockElement(block: PageBlock, context: Context): ReactElement {
  const { safe, marks } = context;
  const leftOut = context.pictureLeftOut && PICTURE_SECTIONS.has(block.sectionId);
  const [first, ...others] = block.paragraphs;
  return h(
    View,
    { key: block.sectionId, wrap: !keepsSectionWhole(asSection(block)) },
    h(View, { key: "lead", wrap: false }, heading(2, block.title, safe), ...(first === undefined ? [] : [paragraph(first, safe, "p0")])),
    ...others.map((text, index) => paragraph(text, safe, `p${index + 1}`)),
    ...(leftOut ? [paragraph(PICTURE_LEFT_OUT, safe, "left-out")] : []),
    ...block.tables.map((table, index) => tableGroup(table, index, safe, marks)),
  );
}

import { Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import type { ImageMap } from "@/lib/flat/images";
import type { FlatModel } from "@/lib/flat/model";
import { PDF_FONT_FAMILY } from "@/lib/flat/pdf-font";
import { renderPdf } from "@/lib/flat/render-pdf";
import type { FlatViewSection, TechPack } from "../../types";
import { PICTURE_LEFT_OUT } from "../limits";
import type { ExportSection } from "../tables";
import { keepsSectionWhole, keepsTableWhole } from "./keep";
import { dataTable, heading, paragraph, type Safe } from "./parts";
import { COLOURS, CONTENT_WIDTH, SIZES } from "./styles";

export interface Context {
  readonly pack: TechPack;
  readonly images: ImageMap;
  readonly safe: Safe;
  /** True when a picture was left out for size, so the document says so in words. */
  readonly pictureLeftOut: boolean;
}

const DRAWING_GAP = 16;
const DRAWING_WIDTH = (CONTENT_WIDTH - DRAWING_GAP) / 2;

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

const drawings = (context: Context): ReactElement =>
  h(
    View,
    { key: "drawings", style: { flexDirection: "row", gap: DRAWING_GAP, marginVertical: 6 } },
    ...context.pack.flats.views.map((view) => drawing(view, context)),
  );

/** A table with its heading and sentence. A short table is not split across pages. */
function tableGroup(table: ExportSection["tables"][number], index: number, safe: Safe): ReactElement {
  return h(
    View,
    { key: `t${index}`, wrap: !keepsTableWhole(table) },
    ...(table.title === null ? [] : [heading(3, table.title, safe)]),
    ...(table.intro === null ? [] : [paragraph(table.intro, safe, `i${index}`)]),
    ...(table.rows.length === 0 ? [] : [dataTable(table, safe)]),
  );
}

/** One section: its title, its sentences, its drawings when it is the flats, then its tables. */
export function sectionElement(section: ExportSection, context: Context): ReactElement {
  const { safe } = context;
  const leftOut = context.pictureLeftOut && (section.id === "flats" || section.id === "artwork");
  const [first, ...others] = section.paragraphs;
  return h(
    View,
    // The drawings cannot be split, so the flats start on a page of their own rather than leave a heading alone.
    { key: section.id, break: section.id === "flats", wrap: !keepsSectionWhole(section) },
    h(View, { key: "lead", wrap: false }, heading(2, section.title, safe), ...(first === undefined ? [] : [paragraph(first, safe, "p0")])),
    ...others.map((text, index) => paragraph(text, safe, `p${index + 1}`)),
    ...(leftOut ? [paragraph(PICTURE_LEFT_OUT, safe, "left-out")] : []),
    ...(section.id === "flats" ? [drawings(context)] : []),
    ...section.tables.map((table, index) => tableGroup(table, index, safe)),
  );
}

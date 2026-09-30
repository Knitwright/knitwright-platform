import { Image, Text, View } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import { PDF_FONT_FAMILY } from "@/lib/flat/pdf-font";
import type { ExportIllustration, ExportIllustrations } from "../illustrations";
import { heading, paragraph, type Safe } from "./parts";
import { COLOURS, CONTENT_WIDTH, SIZES } from "./styles";

const GAP = 16;
const PICTURE_WIDTH = (CONTENT_WIDTH - GAP) / 2;

const figure = (item: ExportIllustration, safe: Safe): ReactElement =>
  h(
    View,
    { key: item.view, wrap: false, style: { width: PICTURE_WIDTH } },
    h(Image, { src: item.src, style: { width: PICTURE_WIDTH, borderWidth: 0.5, borderColor: COLOURS.line } }),
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.cell, color: COLOURS.muted, marginTop: 3 } }, safe(item.caption)),
  );

/**
 * The AI pictures, on a page of their own after the specification. The label says what they
 * are before any picture is seen. Plan step 14, task 5.
 */
export function illustrationsElement(illustrations: ExportIllustrations, safe: Safe): ReactElement {
  return h(
    View,
    { key: "illustrations", break: true },
    heading(2, "Illustrations", safe),
    h(Text, { style: { fontFamily: PDF_FONT_FAMILY, fontSize: SIZES.body, color: COLOURS.warn, marginBottom: 4 } }, safe(illustrations.label)),
    ...(illustrations.note ? [paragraph(illustrations.note, safe, "note")] : []),
    h(View, { style: { flexDirection: "row", gap: GAP, marginTop: 6 } }, ...illustrations.items.map((item) => figure(item, safe))),
  );
}

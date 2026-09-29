import { join } from "node:path";
import { Document, Font, G, Image, Page, Path, Svg, Text, renderToBuffer } from "@react-pdf/renderer";
import { createElement as h } from "react";
import sharp from "sharp";

/** The spike of plan step 7. See docs/decisions/0008-pdf-renderer.md. */
export const SPIKE_FONT_FILE = join(process.cwd(), "assets", "fonts", "Geist-Regular.ttf");
export const SPIKE_CALLOUT = "Callout: chest width 52.0 cm";

async function logoPng(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: "#cc3300" } })
    .png()
    .toBuffer();
}

async function spikeDocument() {
  Font.register({ family: "Geist", src: SPIKE_FONT_FILE });
  const logo = await logoPng();
  return h(
    Document,
    { title: "Flat spike" },
    h(
      Page,
      { size: "A4", style: { padding: 20, fontFamily: "Geist" } },
      h(Text, { style: { fontSize: 12 } }, SPIKE_CALLOUT),
      h(
        Svg,
        { width: 300, height: 300, viewBox: "0 0 3000 3000" },
        h(
          G,
          null,
          h(Path, { d: "M 500 500 L 2500 500 C 2700 1500 2700 2000 2500 2800 L 500 2800 Z", fill: "#dddddd", stroke: "#111111", strokeWidth: 12 }),
          h(Path, { d: "M 650 650 L 2350 650", stroke: "#111111", strokeWidth: 8, strokeDasharray: "40 30", fill: "none" }),
        ),
      ),
      h(Image, { src: { data: logo, format: "png" }, style: { width: 40, height: 40 } }),
    ),
  );
}


/** Draws the spike flat and returns the PDF bytes. */
export async function renderSpikePdf(): Promise<Buffer> {
  return renderToBuffer(await spikeDocument());
}

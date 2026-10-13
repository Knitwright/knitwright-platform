import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { renderSvg } from "@/lib/flat/render-svg";
import { fullDesign, packFor } from "@/lib/techpack/fixtures/designs";

const output = process.env.SAMPLE_OUT ?? ".";
const pack = packFor(fullDesign("polo"));
for (const view of pack.flats.views) {
  if (!view.model) continue;
  const svg = renderSvg(view.model);
  writeFileSync(join(output, `full-polo-${view.view}.svg`), svg);
  writeFileSync(join(output, `full-polo-${view.view}.png`), await sharp(Buffer.from(svg)).flatten({ background: "#fff" }).resize({ width: 700 }).png().toBuffer());
}

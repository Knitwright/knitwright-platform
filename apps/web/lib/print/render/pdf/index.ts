import { pageSizeMm, type PieceScene } from "@/lib/print/scene";
import { flattenScene } from "../raster";
import { artItems } from "../svg";
import { pieceTitle } from "../format";
import type { FlatArt } from "../types";
import { buildPageContent, POINTS_PER_MM } from "./content";
import { decodePicture, imageDict, maskDict, uniqueImages } from "./images";
import { assemble, deflate, pdfString, streamBody, textBody } from "./writer";

const CATALOG = 1;
const PAGES = 2;
const PAGE = 3;
const CONTENT = 4;
const INFO = 5;
const GUIDES_GROUP = 6;
const FIRST_FREE = 7;

const points = (mm: number): string => (mm * POINTS_PER_MM).toFixed(4);

/**
 * The print file as PDF 1.7: one page, real vector operators, pictures as image objects, and the guides in a
 * layer a RIP can hide. The same scene always gives the same bytes. A scene with a blending layer is
 * flattened first (or pass the `flat` art you already have).
 */
export async function renderPdf(scene: PieceScene, flat?: FlatArt): Promise<Uint8Array> {
  const art = scene.raster ? (flat ?? (await flattenScene(scene))) : undefined;
  const { stream, resources } = buildPageContent(scene, artItems(scene, art));
  const pictures = await Promise.all(uniqueImages(resources.images).map(decodePicture));

  const stateIds = resources.graphicsStates.map((_, index) => FIRST_FREE + index);
  let next = FIRST_FREE + stateIds.length;
  const placed = pictures.map((picture) => {
    const imageId = next;
    const maskId = picture.alpha ? next + 1 : null;
    next += maskId === null ? 1 : 2;
    return { picture, imageId, maskId };
  });

  const size = pageSizeMm(scene);
  const states = stateIds.map((id, index) => `/GS${index} ${id} 0 R`).join(" ");
  const xobjects = placed.map(({ imageId }, index) => `/Im${index} ${imageId} 0 R`).join(" ");
  const resourceText = `<< /ExtGState << ${states} >> /XObject << ${xobjects} >> /Properties << /OC0 ${GUIDES_GROUP} 0 R >> >>`;

  const bodies = new Map<number, Uint8Array>([
    [CATALOG, textBody(`<< /Type /Catalog /Pages ${PAGES} 0 R /OCProperties << /OCGs [${GUIDES_GROUP} 0 R] /D << /Order [${GUIDES_GROUP} 0 R] /ON [${GUIDES_GROUP} 0 R] >> >> >>`)],
    [PAGES, textBody(`<< /Type /Pages /Kids [${PAGE} 0 R] /Count 1 >>`)],
    [PAGE, textBody(`<< /Type /Page /Parent ${PAGES} 0 R /MediaBox [0 0 ${points(size.width)} ${points(size.height)}] /Resources ${resourceText} /Contents ${CONTENT} 0 R >>`)],
    [CONTENT, streamBody("/Filter /FlateDecode", deflate(new Uint8Array(Buffer.from(stream, "latin1"))))],
    [INFO, textBody(`<< /Title ${pdfString(pieceTitle(scene))} /Subject ${pdfString(scene.noteLines.join("; "))} /Producer (Knitwright) >>`)],
    [GUIDES_GROUP, textBody("<< /Type /OCG /Name (Guides) >>")],
  ]);
  resources.graphicsStates.forEach((dict, index) => bodies.set(FIRST_FREE + index, textBody(dict)));
  for (const { picture, imageId, maskId } of placed) {
    bodies.set(imageId, streamBody(imageDict(picture, maskId), picture.rgb));
    if (maskId !== null && picture.alpha) bodies.set(maskId, streamBody(maskDict(picture), picture.alpha));
  }
  const ordered = [...bodies.keys()].sort((a, b) => a - b).map((id) => bodies.get(id) ?? new Uint8Array());
  return assemble(ordered, CATALOG, INFO);
}

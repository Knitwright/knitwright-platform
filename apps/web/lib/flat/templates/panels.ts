import { chain, closedCommands, joinChains, lineTo, mirrorChain, pt, type Chain } from "../chain";
import type { FlatPath, View } from "../model";
import { panelPath } from "../paths";
import { CUFF_HEIGHT, SIDE_PANEL_WIDTH } from "./basis";
import { collarChain, neckbandChain, placketChain } from "./collar";
import { bodyOutline, hemSegment, sleeveChains, type Frame } from "./pieces";

/** What a template needs from the design to draw its panels. */
export interface PanelContext {
  readonly frame: Frame;
  readonly view: View;
  readonly nameOf: (panelId: string) => string;
  readonly fillOf: (panelId: string) => string;
  readonly wanted: (panelId: string) => boolean;
}

/** The side strips, one on each side of the body, as a closed shape. */
export function sidePanelChains(frame: Frame): Chain[] {
  const { basis } = frame;
  const width = SIDE_PANEL_WIDTH * basis.chest;
  const inner = basis.halfHem - width;
  const hemRun = hemSegment(frame, basis.halfHem, inner);
  const right = joinChains(
    chain(basis.underarm, lineTo(hemRun.start)),
    hemRun,
    chain(hemRun.pieces.at(-1)?.to ?? hemRun.start, lineTo(pt(basis.underarm.x - width, basis.underarm.y))),
  );
  return [right, mirrorChain(right)];
}

/** The sleeves and the cuffs. In the front view the wearer's left sleeve is on the right of the page. */
export function sleeveShapes(frame: Frame): { left: Chain; right: Chain; cuffs: Chain[] } {
  const cuffLength = frame.options.cuffs ? CUFF_HEIGHT * frame.basis.chest : 0;
  const { sleeve, cuff } = sleeveChains(frame, cuffLength);
  const onRight = sleeve;
  const onLeft = mirrorChain(sleeve);
  const cuffs = cuff ? [cuff, mirrorChain(cuff)] : [];
  return frame.view === "front" ? { left: onRight, right: onLeft, cuffs } : { left: onLeft, right: onRight, cuffs };
}

/** Every panel this view shows, in the order they are drawn: base pieces first, then what lies on top. */
export function panelPaths(context: PanelContext): FlatPath[] {
  const { frame, view } = context;
  const bodyId = `body-${view}`;
  const shapes = sleeveShapes(frame);
  const collar = collarChain(frame);
  const wanted: [string, readonly Chain[] | null][] = [
    [bodyId, [bodyOutline(frame)]],
    ["sleeve-left", [shapes.left]],
    ["sleeve-right", [shapes.right]],
    ["side-panels", frame.options.sidePanels ? sidePanelChains(frame) : null],
    ["cuffs", shapes.cuffs.length > 0 ? shapes.cuffs : null],
    ["neckband", frame.options.collar === "none" ? [neckbandChain(frame)] : null],
    ["collar", collar ? [collar] : null],
    ["placket", view === "front" && frame.options.placket !== "none" ? [placketChain(frame)] : null],
  ];
  return wanted.flatMap(([panelId, chains]) =>
    chains && context.wanted(panelId)
      ? [panelPath(context.nameOf(panelId), panelId, closedCommands(...chains), context.fillOf(panelId))]
      : [],
  );
}

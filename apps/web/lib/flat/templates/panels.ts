import { closedCommands, mirrorChain, type Chain } from "../chain";
import { darken } from "../colour";
import type { FlatPath, View } from "../model";
import { insidePath, panelPath } from "../paths";
import { CUFF_HEIGHT } from "./basis";
import { collarChain, neckbandChain, placketChain } from "./collar";
import { insideBackChain } from "./inside-back";
import { bodyOutline, sleeveChains, type Frame } from "./pieces";
import { sidePanelChains } from "./side-panels";

/** How much of the body colour the inside of the garment keeps: a slightly darker tone. */
const INSIDE_TONE = 0.86;

/** What a template needs from the design to draw its panels. */
interface PanelContext {
  readonly frame: Frame;
  readonly view: View;
  readonly nameOf: (panelId: string) => string;
  readonly fillOf: (panelId: string) => string;
  readonly wanted: (panelId: string) => boolean;
}

/** The sleeves and the cuffs. In the front view the wearer's left sleeve is on the right of the page. */
function sleeveShapes(frame: Frame): { left: Chain; right: Chain; cuffs: Chain[] } {
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
    ["placket", view === "front" && frame.options.placket !== "none" ? [placketChain(frame)] : null],
    ["neckband", frame.options.collar === "none" ? [neckbandChain(frame)] : null],
    ["collar", collar ? [collar] : null],
  ];
  const drawn = wanted.flatMap(([panelId, chains]) =>
    chains && context.wanted(panelId)
      ? [panelPath(context.nameOf(panelId), panelId, closedCommands(...chains), context.fillOf(panelId))]
      : [],
  );
  const inside = insideBackChain(frame);
  // The inside of the back is under everything else: it is what shows through the neck opening.
  return inside ? [insidePath("Inside of the neck", closedCommands(inside), darken(context.fillOf(bodyId), INSIDE_TONE)), ...drawn] : drawn;
}

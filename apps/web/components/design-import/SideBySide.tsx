import { LayerList } from "./LayerList";
import { Limits } from "./Limits";
import { PictureOverlay } from "./PictureOverlay";
import { StackDrawing } from "./StackDrawing";
import type { ImportView } from "@/lib/design-import/view-model";
import type { ViewLandmarks } from "@/lib/design-import/types";

type Props = Readonly<{
  view: ImportView;
  ticked: ReadonlySet<string>;
  moved: ViewLandmarks;
  busy: boolean;
  onTick: (id: string, on: boolean) => void;
  onMove: (view: "front" | "back", id: string, x: number, y: number) => void;
}>;

/**
 * The reading beside your picture: the picture on the left, our drawing on the right, how sure we are of each layer
 * below, and the limits, which stay on screen whatever is ticked.
 */
export function SideBySide({ view, ticked, moved, busy, onTick, onMove }: Props) {
  return (
    <div className="flex flex-col gap-4" data-testid="design-import-review">
      <div>
        <h2 className="text-lg font-medium text-ink">{view.heading}</h2>
        <p className="text-[15px] leading-relaxed text-muted">{view.summary}</p>
        <p className="mt-1 text-sm text-ink-2">{view.pictureNote}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PictureOverlay view={view} moved={moved} onMove={onMove} disabled={busy} />
        <StackDrawing view={view} />
      </div>
      <LayerList rows={view.rows} ticked={ticked} disabled={busy} onTick={onTick} />
      {view.emptyViews.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2" data-testid="design-import-empty">
          {view.emptyViews.map((empty) => (
            <li key={empty.view}>{empty.sentence}</li>
          ))}
        </ul>
      ) : null}
      {[...view.notes, ...view.dpiWarnings, ...view.guessed].length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          {[...view.notes, ...view.dpiWarnings, ...view.guessed].map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted">Fitted to: {view.fittedTo}</p>
      <Limits limits={view.limits} />
    </div>
  );
}

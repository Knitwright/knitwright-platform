import { Button } from "@/components/ui/Button";
import type { Layer } from "@/lib/artwork-stack";
import { layerLabel } from "@/lib/panel-layers/labels";

type LayerListProps = Readonly<{
  /** The view's layers, bottom first. They are listed top first, as in an editor. */
  layers: readonly Layer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onRemove: (id: string) => void;
}>;

/** Only artwork and text are removed from here: a base colour and a pattern are the design's own, and names and numbers come from the roster. */
const REMOVABLE = new Set(["graphic", "text"]);

export function LayerList({ layers, selectedId, onSelect, onMove, onRemove }: LayerListProps) {
  return (
    <section aria-labelledby="layers-heading" className="flex flex-col gap-2">
      <h2 id="layers-heading" className="text-base font-medium text-ink">
        Layers on this panel
      </h2>
      <ul data-testid="layer-list" className="flex flex-col gap-1">
        {[...layers].reverse().map((layer, at, shown) => (
          <li key={layer.id} className="flex items-center gap-2 text-sm">
            <button
              type="button"
              aria-pressed={layer.id === selectedId}
              onClick={() => onSelect(layer.id)}
              className="min-h-11 flex-1 rounded-lg border border-white/15 px-3 text-left text-ink aria-pressed:border-white/60"
            >
              {layerLabel(layer)}
            </button>
            <Button type="button" variant="quiet" aria-label={`Move ${layerLabel(layer)} up`} disabled={at === 0} onClick={() => onMove(layer.id, "up")}>
              Up
            </Button>
            <Button type="button" variant="quiet" aria-label={`Move ${layerLabel(layer)} down`} disabled={at === shown.length - 1} onClick={() => onMove(layer.id, "down")}>
              Down
            </Button>
            {REMOVABLE.has(layer.kind) ? (
              <Button type="button" variant="quiet" aria-label={`Remove ${layerLabel(layer)}`} onClick={() => onRemove(layer.id)}>
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

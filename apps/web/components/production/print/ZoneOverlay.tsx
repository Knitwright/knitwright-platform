import type { OverlayView } from "@/lib/print/zones/overlay";
import overlayData from "@/lib/print/zones/overlay-data.json";

const path = (ring: readonly (readonly [number, number])[]): string => `M${ring.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

function View({ view }: { view: OverlayView }) {
  const xs = view.outline.map(([x]) => x);
  const ys = view.outline.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs) - 20, Math.max(...xs) + 20, Math.min(...ys) - 20, Math.max(...ys) + 20];
  return (
    <figure className="m-0 flex flex-col items-center gap-1">
      <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} className="h-48 w-auto" role="img" aria-label={`${view.label}: where marks can go`}>
        <path d={path(view.outline)} fill="none" stroke="currentColor" strokeWidth={4} />
        {view.zones.map((zone) => (
          <g key={zone.id}>
            <path d={path(zone.ring)} fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth={2} strokeDasharray="8 6" />
            <title>{zone.label}</title>
          </g>
        ))}
      </svg>
      <figcaption className="text-[12px] text-chalk-muted">{view.label}</figcaption>
    </figure>
  );
}

/**
 * The standard places for marks, drawn on the shape of the garment. The shape is the sample jersey until the pattern library
 * holds the design's own pattern. The drawing's numbers come from `overlay-data.json`, which a test keeps in step with
 * `overlayModel`, so this client component carries no geometry code.
 */
export function ZoneOverlay() {
  const views = overlayData as unknown as OverlayView[];
  return (
    <div data-testid="zone-overlay" className="flex flex-wrap items-end gap-4 text-ink">
      {views.map((view) => (
        <View key={view.id} view={view} />
      ))}
    </div>
  );
}

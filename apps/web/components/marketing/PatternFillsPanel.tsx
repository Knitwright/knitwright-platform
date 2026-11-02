"use client";

import type { LaunchPanelProps } from "@/lib/launch";
import { asSettings, selectedMarketing, shapeSlots, withFill } from "@/lib/marketing";
import { PANEL_CHIP, PanelFrame } from "./PanelFrame";
import { useMarketingServices } from "./services";

/**
 * THE PATTERN FILLS PANEL (spec Launch shell: "Pattern fills -- repeat prints from your library, as
 * fills for shapes and backgrounds"; plan v5 L4, decision 0094).
 *
 * The repeat prints come from the brand's own library, which a panel cannot fetch: they arrive
 * through `MarketingServicesProvider`, and until something fills it the panel shows the empty state
 * that names where a repeat print comes from.
 *
 * A fill goes in a shape slot, never over a mockup, so nothing here can reach the garment.
 */
export default function PatternFillsPanel({ context, commands }: LaunchPanelProps) {
  const { fills } = useMarketingServices();
  const selected = selectedMarketing(context);
  const places = selected ? shapeSlots(selected.slots) : [];
  const ready = fills.length > 0 && places.length > 0;

  return (
    <PanelFrame id="pattern-fills" ready={ready} busy={context.busy} onAction={() => commands.addBoard("marketing", { x: 0, y: 0 })}>
      <ul className="grid grid-cols-2 gap-2" data-testid="marketing-fills">
        {fills.map((fill) => {
          const slot = places[0];
          const current = selected && slot ? selected.settings.fills[slot.id] === fill.id : false;
          return (
            <li key={fill.id}>
              <button
                type="button"
                disabled={context.busy}
                aria-pressed={current}
                className={`${PANEL_CHIP} w-full justify-start gap-2`}
                onClick={() => selected && slot && commands.setBoardSettings(selected.board.id, asSettings(withFill(selected.settings, slot.id, fill.id)))}
              >
                {fill.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a repeat print's own thumbnail, already in our storage
                  <img src={fill.thumbnail} alt="" aria-hidden="true" className="size-6 shrink-0 rounded-md border border-white/15 object-cover" />
                ) : (
                  <span aria-hidden="true" className="size-6 shrink-0 rounded-md border border-white/15 bg-tile-2" />
                )}
                <span className="truncate">{fill.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] leading-relaxed text-ink-2">A fill goes behind the layout. It never goes over a mockup: the garment stays the picture the platform drew.</p>
    </PanelFrame>
  );
}

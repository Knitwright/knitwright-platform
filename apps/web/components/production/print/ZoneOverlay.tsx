import { pieceFrame, pointsText, zoneWords } from "@/lib/print/ui";
import type { PieceSummary } from "@/lib/print/server/summary";

/**
 * One pattern piece drawn from its cut outline, with the zones where a mark may go over it. The piece is shown the way the print
 * file has it. A zone is a place with its own clear space, not a promise that a mark fits.
 */
export function ZoneOverlay({ piece }: { piece: PieceSummary }) {
  const frame = pieceFrame(piece.outline, 20);
  const label = `${piece.name}, with ${piece.zones.length === 0 ? "no zones" : piece.zones.map((z) => zoneWords(z.purpose).toLowerCase()).join(", ")}`;
  return (
    <figure className="m-0 flex flex-col gap-1" data-testid="zone-overlay">
      <svg viewBox={frame.viewBox} role="img" aria-label={label} className="h-auto w-full max-w-[420px] rounded-[8px] border border-hairline bg-surface">
        <polygon points={pointsText(piece.outline)} fill="#f3f4f6" stroke="#1f2937" strokeWidth={1.5} />
        {piece.zones.map((zone) => (
          <g key={zone.id}>
            <polygon points={pointsText(zone.polygon)} fill="#2563eb" fillOpacity={0.18} stroke="#2563eb" strokeWidth={1.2} strokeDasharray="6 4" />
          </g>
        ))}
      </svg>
      <figcaption className="text-[12px] text-chalk-muted">{label}.</figcaption>
    </figure>
  );
}

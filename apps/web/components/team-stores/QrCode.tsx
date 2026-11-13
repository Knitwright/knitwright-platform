import { cx } from "@/components/ui/cx";
import { qrPath } from "@/lib/team-stores/qr";

/**
 * A team store's QR code (decision 0153), drawn as one SVG path: dark squares on a light square whatever the
 * theme, because a scanner reads dark on light. Nothing is fetched and nothing is stored.
 */
export function QrCode({ text, label, className }: Readonly<{ text: string; label: string; className?: string }>) {
  const qr = qrPath(text);
  return (
    <svg viewBox={`0 0 ${qr.box} ${qr.box}`} role="img" aria-label={label} shapeRendering="crispEdges" className={cx("size-36 shrink-0 rounded-md border border-border", className)}>
      <rect width={qr.box} height={qr.box} className="fill-on-dark" />
      <path d={qr.d} className="fill-text" />
    </svg>
  );
}

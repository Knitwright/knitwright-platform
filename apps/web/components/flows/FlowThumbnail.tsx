import { stepsOfSection, type FlowTemplateSpec } from "@/lib/flows";

/**
 * The Thumbnail board of a flow template (spec F-L4).
 *
 * It is drawn from the pack's own shape -- a column per section, a block per board -- rather than
 * being a picture. **No third-party asset is committed to this repository** (plan v5, rules every
 * workstream follows), and a picture of a pack would go stale the moment the pack changed; this
 * cannot, because it *is* the pack. It is also the same for the same pack every time, so a test can
 * check it.
 *
 * It carries no text, so it is hidden from a screen reader: the card beside it says the pack's name,
 * its sections and its asset count in words.
 */

const COLUMN = 22;
const BLOCK = 14;

export function FlowThumbnail({ spec, className = "" }: Readonly<{ spec: FlowTemplateSpec; className?: string }>) {
  const columns = spec.sections.map((section) => stepsOfSection(spec, section));
  const tallest = Math.max(...columns.map((column) => column.length), 1);
  const width = spec.sections.length * COLUMN + 6;
  const height = tallest * (BLOCK + 4) + 6;

  return (
    <svg
      aria-hidden="true"
      data-testid={`flow-thumbnail-${spec.slug}`}
      viewBox={`0 0 ${width} ${height}`}
      className={`h-16 w-full rounded-xl border border-white/10 bg-tile-2/90 ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {columns.map((column, at) =>
        column.map((step, row) => (
          <rect
            key={step.key}
            x={at * COLUMN + 4}
            y={row * (BLOCK + 4) + 4}
            width={COLUMN - 8}
            height={BLOCK}
            rx={3}
            fill={step.generation === "model" ? "rgba(243,194,122,0.5)" : "rgba(130,150,255,0.45)"}
          />
        )),
      )}
      {columns.slice(0, -1).map((column, at) => (
        <line
          key={spec.sections[at]}
          x1={at * COLUMN + COLUMN - 4}
          y1={height / 2}
          x2={(at + 1) * COLUMN + 4}
          y2={height / 2}
          stroke="rgba(130,150,255,0.5)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

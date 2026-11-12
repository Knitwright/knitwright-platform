import { Row, Section } from "../frame";

/** Token, swatch class and the hex from docs/spec/10-design-system.md §2, for the eye only. */
const COLOURS = [
  ["navy", "bg-navy", "#0B1F4B"],
  ["navy-2", "bg-navy-2", "#142C63"],
  ["navy-3", "bg-navy-3", "#06132F"],
  ["electric", "bg-electric", "#2F6BFF"],
  ["electric-soft", "bg-electric-soft", "#EAF0FF"],
  ["link (text)", "bg-link", "#2558E8"],
  ["gold", "bg-gold", "#F2B705"],
  ["gold-soft", "bg-gold-soft", "#FFF4CC"],
  ["bg", "bg-bg", "#FFFFFF"],
  ["soft", "bg-soft", "#F3F4F6"],
  ["soft-2", "bg-soft-2", "#ECEEF2"],
  ["border", "bg-border", "#E5E7EB"],
  ["dot", "bg-dot", "#D5D9E0"],
  ["text", "bg-text", "#111318"],
  ["text-2", "bg-text-2", "#374151"],
  ["muted", "bg-muted", "#6B7280"],
  ["muted-2", "bg-muted-2", "#9CA3AF"],
] as const;

const STATUS = [
  ["ok", "bg-ok-soft text-ok"],
  ["warn", "bg-warn-soft text-warn"],
  ["bad", "bg-bad-soft text-bad-strong"],
  ["info", "bg-info-soft text-link"],
] as const;

const TYPE = [
  ["display", "text-display"],
  ["h1", "text-h1"],
  ["h2", "text-h2"],
  ["h3", "text-h3"],
  ["title", "text-title"],
  ["body-lg", "text-body-lg"],
  ["body", "text-body"],
  ["small", "text-small"],
  ["caption", "text-caption"],
  ["micro", "eyebrow"],
] as const;

const RADII = ["rounded-xs", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-full"] as const;
const SHADOWS = ["shadow-e1", "shadow-e2", "shadow-e3", "shadow-e4"] as const;

function Swatches() {
  return (
    <Row label="Colour (§2)">
      {COLOURS.map(([name, swatch, hex]) => (
        <figure key={name} className="m-0 flex w-28 flex-col gap-1.5">
          <span className={`h-12 rounded-md border border-border ${swatch}`} />
          <figcaption className="flex flex-col text-caption">
            <span className="font-semibold text-text">{name}</span>
            <span className="font-mono text-muted">{hex}</span>
          </figcaption>
        </figure>
      ))}
    </Row>
  );
}

function Scale() {
  return (
    <Row label="Type (§3): Inter, cv11 and ss01">
      <div className="flex w-full flex-col gap-2">
        {TYPE.map(([name, style]) => (
          <p key={name} className={`${style} text-text`}>
            {name} · Lahore Lions home kit 2027 · 0123456789
          </p>
        ))}
      </div>
    </Row>
  );
}

function Shapes() {
  return (
    <>
      <Row label="Radius (§5)">
        {RADII.map((radius) => (
          <span key={radius} className={`grid h-16 w-24 place-items-center border border-border bg-soft text-caption text-text-2 ${radius}`}>
            {radius.replace("rounded-", "r-")}
          </span>
        ))}
      </Row>
      <Row label="Elevation (§5)">
        {SHADOWS.map((shadow) => (
          <span key={shadow} className={`grid h-20 w-32 place-items-center rounded-lg bg-bg text-caption text-muted ${shadow}`}>
            {shadow.replace("shadow-", "")}
          </span>
        ))}
      </Row>
      <Row label="Canvas (§8): soft-2 with a 24 px dot grid">
        <span className="canvas-dots block h-32 w-full rounded-lg" />
      </Row>
    </>
  );
}

export function FoundationsSection() {
  return (
    <Section id="foundations" title="Foundations">
      <Swatches />
      <Row label="Status (§2)">
        {STATUS.map(([name, style]) => (
          <span key={name} className={`rounded-md px-3 py-2 text-body font-semibold ${style}`}>
            {name}
          </span>
        ))}
      </Row>
      <Scale />
      <Shapes />
    </Section>
  );
}

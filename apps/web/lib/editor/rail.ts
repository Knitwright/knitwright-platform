import { RAIL_SEGMENTS, type RailSegment } from "./slots";

/**
 * The left rail's segmented toggle: Form, Library, Specs (spec F-S4). Plain data and functions, so the
 * screen holds markup and wiring only, as `lib/workspace/tools.ts` does for the tool rail inside Form.
 */

interface SegmentInfo {
  readonly id: RailSegment;
  /** The word on the segment. */
  readonly label: string;
  /** The heading of the panel it opens. */
  readonly title: string;
  /** One sentence on what the toolbar is for. */
  readonly lead: string;
}

export const DEFAULT_SEGMENT: RailSegment = "form";

export const SEGMENTS: Readonly<Record<RailSegment, SegmentInfo>> = {
  form: {
    id: "form",
    label: "Form",
    title: "Form",
    lead: "The options and lengths this base article is made in. Only what the factory has approved is offered.",
  },
  library: {
    id: "library",
    label: "Library",
    title: "Library",
    lead: "Fabrics, colours, pattern fills and graphics to put on the design.",
  },
  specs: {
    id: "specs",
    label: "Specs",
    title: "Specs",
    lead: "Measure the pattern and write what you measure into the tech pack.",
  },
};

const isSegment = (value: string): value is RailSegment => (RAIL_SEGMENTS as readonly string[]).includes(value);

/** The segment the address names, or Form. A name given twice counts once. */
export function parseSegment(value: string | readonly string[] | null | undefined): RailSegment {
  const first = typeof value === "string" ? value : value?.[0];
  return first && isSegment(first) ? first : DEFAULT_SEGMENT;
}

export const segmentTabId = (segment: RailSegment): string => `rail-tab-${segment}`;
export const segmentPanelId = (segment: RailSegment): string => `rail-panel-${segment}`;

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREVIOUS_KEYS = new Set(["ArrowUp", "ArrowLeft"]);

/** The segment a key moves to, as a tab list does: arrows step and wrap, Home and End jump to the ends. */
export function segmentKeyTarget(current: RailSegment, key: string): RailSegment | null {
  const last = RAIL_SEGMENTS.length - 1;
  const at = RAIL_SEGMENTS.indexOf(current);
  if (key === "Home") return RAIL_SEGMENTS[0];
  if (key === "End") return RAIL_SEGMENTS[last];
  if (NEXT_KEYS.has(key)) return RAIL_SEGMENTS[at === last ? 0 : at + 1];
  if (PREVIOUS_KEYS.has(key)) return RAIL_SEGMENTS[at <= 0 ? last : at - 1];
  return null;
}

/**
 * The one-screen design workspace: which tools it has, which sections each tool shows, how the
 * address names the open tool, and the four steps of the journey in its header. Plain data and
 * functions, so the screen holds markup and wiring only.
 */

/** The tools on the rail, one for each group of controls, in the order a design is usually made. */
export const RAIL_TOOLS = ["garment", "colours", "sizes", "fabric", "logos", "names", "labels", "variants", "comments", "media", "history"] as const;

/** Panels opened from the header's actions and journey, not from the rail. */
export const JOURNEY_TOOLS = ["share", "photoreal", "quote", "production"] as const;

export type RailToolId = (typeof RAIL_TOOLS)[number];
export type JourneyToolId = (typeof JOURNEY_TOOLS)[number];
export type ToolId = RailToolId | JourneyToolId;

/** The parts the panels are built from. Each is shown by exactly one tool. */
export type SectionId =
  | "options"
  | "picture"
  | "details"
  | "colours"
  | "kit-styles"
  | "sizes"
  | "measurements"
  | "fabrics"
  | "trims"
  | "artwork"
  | "names-numbers"
  | "labelling"
  | "variants"
  | "comments"
  | "media"
  | "history"
  | "share"
  | "photoreal"
  | "quote"
  | "production";

interface ToolInfo {
  readonly id: ToolId;
  /** The word under the icon on the rail and the tab bar. */
  readonly label: string;
  /** The heading of the panel. */
  readonly title: string;
  /** One sentence under the heading on what the panel is for. */
  readonly lead: string;
  readonly sections: readonly SectionId[];
}

export const DEFAULT_TOOL: RailToolId = "garment";

export const TOOLS: Readonly<Record<ToolId, ToolInfo>> = {
  garment: {
    id: "garment",
    label: "Garment",
    title: "Garment and options",
    lead: "Choose the fit, neck, sleeves and every other option, or start from a picture.",
    sections: ["options", "picture", "details"],
  },
  colours: {
    id: "colours",
    label: "Colours",
    title: "Colours and kit style",
    lead: "Give each part a drawn colour and the colour code a factory matches.",
    sections: ["kit-styles", "colours"],
  },
  sizes: {
    id: "sizes",
    label: "Sizes",
    title: "Sizes and measurements",
    lead: "Set the size run, then type any measurement to use your own.",
    sections: ["sizes", "measurements"],
  },
  fabric: {
    id: "fabric",
    label: "Fabric",
    title: "Fabric and trims",
    lead: "What each part is made of, and the thread, rib and trims.",
    sections: ["fabrics", "trims"],
  },
  logos: {
    id: "logos",
    label: "Logos",
    title: "Logos and text",
    lead: "Add a crest, a sponsor or words, and place them on the drawing.",
    sections: ["artwork"],
  },
  names: {
    id: "names",
    label: "Names",
    title: "Player names and numbers",
    lead: "Where names and numbers go, and how they are lettered.",
    sections: ["names-numbers"],
  },
  labels: {
    id: "labels",
    label: "Labels",
    title: "Labelling",
    lead: "Care, composition and origin labels, the fold and the bag.",
    sections: ["labelling"],
  },
  variants: {
    id: "variants",
    label: "Ideas",
    title: "Ideas for this design",
    lead: "Other colourways, kit styles and logo placements, drawn for you to try.",
    sections: ["variants"],
  },
  comments: {
    id: "comments",
    label: "Comments",
    title: "Comments",
    lead: "Talk about this design with the other members of your brand. Only members see these; a shared link never shows them.",
    sections: ["comments"],
  },
  media: {
    id: "media",
    label: "Media",
    title: "Marketing media",
    lead: "Pictures and video of this design to share. Studio pictures are free and carry a preview mark until you use credits.",
    sections: ["media"],
  },
  history: {
    id: "history",
    label: "History",
    title: "History",
    lead: "Every saved version, newest first. Any of them can be restored.",
    sections: ["history"],
  },
  share: {
    id: "share",
    label: "Share",
    title: "Committee",
    lead: "Share the design with your committee for votes and comments.",
    sections: ["share"],
  },
  photoreal: {
    id: "photoreal",
    label: "Photo",
    title: "Photoreal images",
    lead: "Pictures made from the drawings, to show people how it will look.",
    sections: ["photoreal"],
  },
  quote: {
    id: "quote",
    label: "Quote",
    title: "Quote",
    lead: "Tell the Knitwright team how many you need and by when.",
    sections: ["quote"],
  },
  production: {
    id: "production",
    label: "Make it",
    title: "Make it",
    lead: "Patterns, fabrics, print files and team orders for getting this design made.",
    sections: ["production"],
  },
};

const ALL_TOOLS: readonly ToolId[] = [...RAIL_TOOLS, ...JOURNEY_TOOLS];

const isTool = (value: string): value is ToolId => (ALL_TOOLS as readonly string[]).includes(value);

/** The tool the address names, or the garment tool. A name given twice counts once. */
export function parseTool(value: string | readonly string[] | null | undefined): ToolId {
  const first = typeof value === "string" ? value : value?.[0];
  return first && isTool(first) ? first : DEFAULT_TOOL;
}

export function toolForSection(section: SectionId): ToolId {
  return ALL_TOOLS.find((id) => TOOLS[id].sections.includes(section)) ?? DEFAULT_TOOL;
}

const designPage = (projectId: string): string => `/studio/${encodeURIComponent(projectId)}`;

/** The address of a design with one tool open. */
export function toolHref(projectId: string, tool: ToolId): string {
  return `${designPage(projectId)}?tool=${tool}`;
}

/** The query of an address with one value set and the others kept, starting with "?". */
export function withSearchParam(search: string, key: string, value: string): string {
  const params = new URLSearchParams(search);
  params.set(key, value);
  return `?${params.toString()}`;
}

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREVIOUS_KEYS = new Set(["ArrowUp", "ArrowLeft"]);

/** The rail tool a key moves to, as a tab list does: arrows step and wrap, Home and End jump. */
export function railKeyTarget(current: ToolId, key: string): RailToolId | null {
  const last = RAIL_TOOLS.length - 1;
  const at = (RAIL_TOOLS as readonly ToolId[]).indexOf(current);
  if (key === "Home") return RAIL_TOOLS[0];
  if (key === "End") return RAIL_TOOLS[last];
  if (NEXT_KEYS.has(key)) return RAIL_TOOLS[at < 0 || at === last ? 0 : at + 1];
  if (PREVIOUS_KEYS.has(key)) return RAIL_TOOLS[at <= 0 ? last : at - 1];
  return null;
}

export type JourneyStepId = "design" | "factory" | "committee" | "quote";

export interface JourneyStep {
  readonly id: JourneyStepId;
  readonly label: string;
  readonly href: string;
  /** The panel the step opens in the workspace, or null for a step on its own page. */
  readonly tool: ToolId | null;
  readonly current: boolean;
}

const STEP_OF_TOOL: Partial<Record<ToolId, JourneyStepId>> = { share: "committee", quote: "quote" };

/** Design, factory file, committee, quote. The open tool decides which step is the current one. */
export function journeySteps(projectId: string, tool: ToolId): readonly JourneyStep[] {
  const current = STEP_OF_TOOL[tool] ?? "design";
  const steps: readonly Omit<JourneyStep, "current">[] = [
    { id: "design", label: "Design", href: toolHref(projectId, DEFAULT_TOOL), tool: DEFAULT_TOOL },
    { id: "factory", label: "Factory file", href: `${designPage(projectId)}/tech-pack`, tool: null },
    { id: "committee", label: "Committee", href: toolHref(projectId, "share"), tool: "share" },
    { id: "quote", label: "Quote", href: toolHref(projectId, "quote"), tool: "quote" },
  ];
  return steps.map((step) => ({ ...step, current: step.id === current }));
}

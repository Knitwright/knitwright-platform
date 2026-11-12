/**
 * THE AI STUDIO WORKFLOWS (`docs/spec/09-screen-map.md` "AI workflows at launch", decision 0141).
 *
 * One entry per workflow card and per `/ai-studio/workflow/:id` page. Each says what it is, the
 * numbered steps of its form, what it makes, what it costs and how it runs (`engine`). The page
 * format is the same for all of them (screen 4); only the form and the engine differ.
 *
 * Nothing here is a model call. An engine names code that already exists (crest to kit, the
 * benchmarks, the launch canvas and its flow templates, the marketing layouts, the shoots) or the
 * deterministic engines this workstream adds (`remix.ts`, `resize.ts`). A workflow whose provider is
 * not switched on says so on its page and offers no output (`availability.ts`).
 */

export const WORKFLOW_CATEGORIES = [
  "kit-design",
  "product-scenes",
  "ads",
  "ugc",
  "product-listings",
  "team-club",
  "mockups",
  "branding",
  "research",
  "tools",
] as const;
export type WorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number];

export const CATEGORY_LABELS: Readonly<Record<WorkflowCategory, string>> = {
  "kit-design": "Kit design",
  "product-scenes": "Product scenes",
  ads: "Ads",
  ugc: "UGC",
  "product-listings": "Product listings",
  "team-club": "Team & club",
  mockups: "Mockups",
  branding: "Branding",
  research: "Research",
  tools: "Tools",
};

/**
 * How a workflow runs.
 * - `crest`, `benchmark`: the existing F-T2 and F-S2 screens, moved here unchanged.
 * - `canvas`: opens a launch canvas set up from the form, where every board runs with its cost shown first.
 * - `remix`, `recolour`: validated variants of a design, from its own parameters (`remix.ts`).
 * - `resize`: one artboard per platform size, from the artboard rows (`resize.ts`).
 * - `brand-board`: the crest read into a palette and saved to the brand.
 * - `unavailable`: no provider exists yet; the page says so and makes nothing.
 * - `link`: a card that opens another page of the platform.
 */
export const ENGINES = ["crest", "benchmark", "canvas", "remix", "recolour", "resize", "brand-board", "unavailable", "link"] as const;
export type WorkflowEngine = (typeof ENGINES)[number];

/** The paid switch a workflow needs, as `lib/flows/real/server.ts` reads them. */
export type ProviderGate = "aiImage" | "aiVideo" | "removeBackground" | null;

export type CostKind = "free" | "credits" | "credits-per-second";

/** The colour pair of a card's output picture: token names only. */
export const TONES = ["navy", "gold", "pitch", "light", "violet", "sunset", "dark", "sky"] as const;
export type Tone = (typeof TONES)[number];

export interface Workflow {
  readonly id: string;
  readonly title: string;
  readonly category: WorkflowCategory;
  /** The one line under the title on the workflow page. */
  readonly lead: string;
  /** The numbered steps of the form, as `09` lists them. */
  readonly steps: readonly string[];
  /** What it makes, in `09`'s words. */
  readonly output: string;
  readonly cost: CostKind;
  /** The "Powered by" line under the output example. Never a third party's name we have no contract with. */
  readonly poweredBy: string;
  readonly engine: WorkflowEngine;
  readonly gate: ProviderGate;
  readonly tone: Tone;
  /** For `link` cards, where the card goes. */
  readonly href?: string;
  /** True for a clip, so the card carries the video badge. */
  readonly video?: boolean;
}

const KIT_ENGINE = "Knitwright kit engine (no AI drawing)";
const RENDERER = "Knitwright renderer (free, garment exact)";
const SHOOTS = "Knitwright shoots, garment locked";

export const WORKFLOWS: readonly Workflow[] = [
  {
    id: "crest-to-kit",
    title: "Crest to kit",
    category: "kit-design",
    lead: "Upload your club crest or pick colours. We build 6–9 complete kits on factory-approved bases, ready to edit.",
    steps: ["Upload your crest or pick up to 3 colours", "Club name", "Sport", "Kit set", "Feel"],
    output: "6–9 validated kits",
    cost: "free",
    poweredBy: KIT_ENGINE,
    engine: "crest",
    gate: null,
    tone: "navy",
  },
  {
    id: "retro-kit-remix",
    title: "Retro kit remix",
    category: "kit-design",
    lead: "Turn one of your designs into four era-true variants. Only colours and the kit pattern change, from the base's own options.",
    steps: ["Pick a product", "Era", "Pattern family"],
    output: "4 validated variants",
    cost: "free",
    poweredBy: KIT_ENGINE,
    engine: "remix",
    gate: null,
    tone: "violet",
  },
  {
    id: "colourway-set",
    title: "Colourway set",
    category: "kit-design",
    lead: "One design in a set of colourways on a launch canvas, with a comparison post.",
    steps: ["Pick a product"],
    output: "Colourway mockups and a comparison post",
    cost: "free",
    poweredBy: RENDERER,
    engine: "canvas",
    gate: null,
    tone: "sunset",
  },
  {
    id: "on-model-try-on",
    title: "On-model try-on",
    category: "product-scenes",
    lead: "Your kit on a model in a sports scene. The garment is the picture the platform drew; only the scene is generated.",
    steps: ["Choose product (garment locked)", "Apply brand", "Model preset", "Scene", "Pose", "Format"],
    output: "1–4 images",
    cost: "credits",
    poweredBy: SHOOTS,
    engine: "canvas",
    gate: "aiImage",
    tone: "pitch",
  },
  {
    id: "flat-lay-studio",
    title: "Flat-lay studio",
    category: "product-scenes",
    lead: "Your kit laid flat on a surface, for listings and posts.",
    steps: ["Product", "Surface", "Format"],
    output: "1–4 images",
    cost: "credits",
    poweredBy: SHOOTS,
    engine: "canvas",
    gate: "aiImage",
    tone: "light",
  },
  {
    id: "kit-launch-ad",
    title: "Kit launch ad",
    category: "ads",
    lead: "Launch posts built around your kit, in your brand, at the size you post at.",
    steps: ["Product", "Apply brand", "Logo or crest", "Highlight", "Campaign", "Style", "Destination"],
    output: "1–4 posts",
    cost: "free",
    poweredBy: RENDERER,
    engine: "canvas",
    gate: null,
    tone: "gold",
  },
  {
    id: "team-store-promo",
    title: "Team store promo",
    category: "ads",
    lead: "Order now, a size reminder and a last chance before your team store closes.",
    steps: ["Team store kit", "Deadline", "Destination"],
    output: "Post + story + QR",
    cost: "free",
    poweredBy: RENDERER,
    engine: "canvas",
    gate: null,
    tone: "pitch",
  },
  {
    id: "try-on-video",
    title: "Try-on video",
    category: "ugc",
    lead: "A short clip of your kit, from a first frame the platform drew.",
    steps: ["Product", "Model", "Setting"],
    output: "5–8 s clip",
    cost: "credits-per-second",
    poweredBy: "Knitwright video, garment-locked first frame",
    engine: "canvas",
    gate: "aiVideo",
    tone: "dark",
    video: true,
  },
  {
    id: "shopify-listing-set",
    title: "Shopify listing set",
    category: "product-listings",
    lead: "Five listing images and a size chart image for one product.",
    steps: ["Product", "Background"],
    output: "5 images + size chart image",
    cost: "free",
    poweredBy: RENDERER,
    engine: "canvas",
    gate: null,
    tone: "sky",
  },
  ...(["matchday", "new-signing", "fixtures-list", "sponsor-thank-you"] as const).map((key) => teamPost(key)),
  {
    id: "mockups",
    title: "Mockup library",
    category: "mockups",
    lead: "Every mockup scene, free and garment exact.",
    steps: [],
    output: "Mockups",
    cost: "free",
    poweredBy: RENDERER,
    engine: "link",
    gate: null,
    tone: "light",
    href: "/mockups",
  },
  {
    id: "club-brand-board",
    title: "Club brand board",
    category: "branding",
    lead: "Upload your crest. We read its colours into a brand board and save them as your brand palette.",
    steps: ["Upload crest or logo"],
    output: "Brand board + brand record",
    cost: "free",
    poweredBy: KIT_ENGINE,
    engine: "brand-board",
    gate: null,
    tone: "violet",
  },
  {
    id: "benchmark-products",
    title: "Benchmark products",
    category: "research",
    lead: "See what comparable products are made of and what customers complain about. A comparison, never a copy.",
    steps: ["Paste 1–5 product links or photos", "Product type"],
    output: "Benchmark cards + compare view",
    cost: "credits",
    poweredBy: "Knitwright benchmarks (robots.txt respected)",
    engine: "benchmark",
    gate: null,
    tone: "light",
  },
  {
    id: "change-kit-colour",
    title: "Change kit colour",
    category: "tools",
    lead: "Recolour a design in one step. Every result is checked before you see it.",
    steps: ["Pick a product and its new colours"],
    output: "Validated recolours",
    cost: "free",
    poweredBy: KIT_ENGINE,
    engine: "recolour",
    gate: null,
    tone: "sunset",
  },
  {
    id: "resize-for-all-socials",
    title: "Resize for all socials",
    category: "tools",
    lead: "One design as an artboard at every social size, on a launch canvas.",
    steps: ["Pick a product"],
    output: "One artboard per size",
    cost: "free",
    poweredBy: RENDERER,
    engine: "resize",
    gate: null,
    tone: "light",
  },
  {
    id: "remove-background",
    title: "Remove background",
    category: "tools",
    lead: "Cut the background out of a picture.",
    steps: ["Upload a picture"],
    output: "A picture with a transparent background",
    cost: "credits",
    poweredBy: "No provider yet",
    engine: "unavailable",
    gate: "removeBackground",
    tone: "dark",
  },
];

function teamPost(key: "matchday" | "new-signing" | "fixtures-list" | "sponsor-thank-you"): Workflow {
  const words = {
    matchday: { id: "matchday-graphic", title: "Matchday graphic", lead: "Who, where and when, over your kit.", tone: "dark" as Tone },
    "new-signing": { id: "new-signing", title: "New signing", lead: "A new player in your kit, with their name and number.", tone: "navy" as Tone },
    "fixtures-list": { id: "fixtures-list", title: "Fixtures list", lead: "The next few games as a list, in your colours.", tone: "pitch" as Tone },
    "sponsor-thank-you": { id: "sponsor-thank-you", title: "Sponsor thank-you", lead: "The shirt with the sponsor on it, and your thanks.", tone: "gold" as Tone },
  }[key];
  return {
    id: words.id,
    title: words.title,
    category: "team-club",
    lead: words.lead,
    steps: ["Product", "Your words", "Format"],
    output: "Posts",
    cost: "free",
    poweredBy: RENDERER,
    engine: "canvas",
    gate: null,
    tone: words.tone,
  };
}

/** The Image and Video generator tabs (`09` screens 5–6): the workflow format, but not cards of the hub. */
export const GENERATORS: readonly Workflow[] = [
  {
    id: "image-generator",
    title: "Image generator",
    category: "product-scenes",
    lead: "Generate scenes around your locked garment, or images for posts. The garment is the picture the platform drew.",
    steps: ["Reference", "Prompt", "Style", "Model", "Aspect"],
    output: "1–4 images",
    cost: "credits",
    poweredBy: SHOOTS,
    engine: "canvas",
    gate: "aiImage",
    tone: "pitch",
  },
  {
    id: "video-generator",
    title: "Video generator",
    category: "ugc",
    lead: "Animate any kit or mockup. The first frame is the garment the platform drew.",
    steps: ["Reference", "End frame", "Prompt", "Preset", "Model", "Duration", "Audio"],
    output: "A 3–15 s clip",
    cost: "credits-per-second",
    poweredBy: "Knitwright video, garment-locked first frame",
    engine: "canvas",
    gate: "aiVideo",
    tone: "pitch",
    video: true,
  },
];

/** One workflow by its id, or null. An id that is not here is a page that does not exist. */
export const workflowById = (id: string): Workflow | null => WORKFLOWS.find((one) => one.id === id) ?? null;

/** A workflow or a generator tab, for the action that sets either one's canvas up. */
export const runnableById = (id: string): Workflow | null => workflowById(id) ?? GENERATORS.find((one) => one.id === id) ?? null;

/** The page of a workflow, or the page a link card opens. */
export const workflowHref = (workflow: Workflow): string => workflow.href ?? `/ai-studio/workflow/${workflow.id}`;

/** What the Generate button says the run costs, in words. */
export const COST_LABELS: Readonly<Record<CostKind, string>> = {
  free: "Free",
  credits: "Credits",
  "credits-per-second": "Credits per second",
};

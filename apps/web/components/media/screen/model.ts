import type { CheckerVerdict, MediaView } from "@/lib/media/contract";
import { SCENE_IDS, SCENE_LABELS, SCENE_VIEWS } from "@/lib/media/lifestyle/scenes";
import type { MediaItemView, MediaSetView } from "@/lib/media/view";
import {
  CLIP_EXISTS,
  CLIP_LOCKED_EXPLANATION,
  CLIP_WAIT,
  DROPPED_EXPLANATION,
  NEEDS_MATCHING_STILL,
  REJECTED_EXPLANATION,
  VERDICT_DRAWN,
  VERDICT_MATCHES,
  VERDICT_NOT_COMPARED,
  VERDICT_PENDING,
  VERDICT_RECORDED,
  VERDICT_REJECTED,
} from "./copy";

/** What the screen draws, worked out from the set the API sends. Pure: no browser, no fetch. */

export type TileGroup = "studio" | "lifestyle" | "turntable" | "clip";
export type TileState = "ready" | "waiting" | "missing" | "rejected";
export type Tone = "ok" | "warn" | "neutral";

export type Tile = Readonly<{
  key: string;
  itemId: string | null;
  group: TileGroup;
  label: string;
  state: TileState;
  /** The picture (watermarked until the set is unlocked), or null where there is none to show. */
  imageHref: string | null;
  videoHref: string | null;
  watermarked: boolean;
  aiGenerated: boolean;
  verdict: Readonly<{ tone: Tone; text: string }>;
  explanation: string | null;
  canRerun: boolean;
  /** Something to save. A null filename leaves the name to the server. */
  download: Readonly<{ href: string; filename: string | null }> | null;
}>;

const STUDIO: readonly Readonly<{ view: MediaView; label: string }>[] = [
  { view: "front", label: "Front" },
  { view: "back", label: "Back" },
  { view: "flat_lay", label: "Flat lay" },
];

const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const lifestyleVerdict = (checker: CheckerVerdict): Tile["verdict"] => {
  switch (checker) {
    case "pending":
      return { tone: "neutral", text: VERDICT_PENDING };
    case "passed":
      return { tone: "ok", text: VERDICT_MATCHES };
    case "rejected":
      return { tone: "warn", text: VERDICT_REJECTED };
    case "not_checked":
      return { tone: "neutral", text: VERDICT_NOT_COMPARED };
  }
};

const base = (group: TileGroup, label: string, key: string): Tile => ({
  key,
  itemId: null,
  group,
  label,
  state: "waiting",
  imageHref: null,
  videoHref: null,
  watermarked: true,
  aiGenerated: false,
  verdict: { tone: "neutral", text: "" },
  explanation: null,
  canRerun: false,
  download: null,
});

/** A picture of a set: shown with its watermark until the set is unlocked, with a download once it is. */
function ready(set: MediaSetView, entry: MediaItemView, group: TileGroup, label: string, verdict: Tile["verdict"]): Tile {
  const image = entry.href;
  return {
    ...base(group, label, entry.id),
    itemId: entry.id,
    state: "ready",
    imageHref: image,
    watermarked: !set.unlocked,
    aiGenerated: entry.kind === "lifestyle" || entry.kind === "clip",
    verdict,
    download: set.unlocked && image ? { href: image, filename: `knitwright-${slug(label)}.png` } : null,
  };
}

function studioTiles(set: MediaSetView): Tile[] {
  return STUDIO.map(({ view, label }) => {
    const entry = set.items.find((candidate) => candidate.kind === "studio_render" && candidate.view === view);
    return entry ? ready(set, entry, "studio", label, { tone: "neutral", text: VERDICT_DRAWN }) : base("studio", label, `studio-${view}`);
  });
}

function lifestyleTiles(set: MediaSetView): Tile[] {
  const own = set.items.filter((candidate) => candidate.kind === "lifestyle");
  if (own.length === 0) return [];
  const running = set.status === "queued" || set.status === "running";
  return SCENE_IDS.map((scene) => {
    const label = SCENE_LABELS[scene];
    const entry = own.find((candidate) => candidate.view === SCENE_VIEWS[scene]);
    if (!entry) {
      const gone = { ...base("lifestyle", label, `lifestyle-${scene}`) };
      return running ? gone : { ...gone, state: "missing", explanation: DROPPED_EXPLANATION, canRerun: true, verdict: lifestyleVerdict("rejected") };
    }
    if (entry.checker === "rejected") {
      return { ...base("lifestyle", label, entry.id), itemId: entry.id, state: "rejected", explanation: REJECTED_EXPLANATION, canRerun: true, verdict: lifestyleVerdict("rejected"), aiGenerated: true };
    }
    return ready(set, entry, "lifestyle", label, lifestyleVerdict(entry.checker));
  });
}

function turntableTile(set: MediaSetView): Tile[] {
  const entry = set.items.find((candidate) => candidate.kind === "turntable");
  if (!entry) return [];
  const video = entry.href ? `${entry.href}/video` : null;
  // The recording is the brand's own and free, so it is theirs to take at once; only its still carries the preview mark.
  return [{ ...ready(set, entry, "turntable", "Turntable", { tone: "neutral", text: VERDICT_RECORDED }), videoHref: video, download: video ? { href: video, filename: null } : null }];
}

function clipTile(set: MediaSetView): Tile[] {
  const entry = set.items.find((candidate) => candidate.kind === "clip");
  if (!entry) return [];
  const video = set.unlocked && entry.href ? `${entry.href}/video` : null;
  const tile = ready(set, entry, "clip", "Clip", { tone: "neutral", text: "AI generated" });
  return [{ ...tile, videoHref: video, download: video ? { href: video, filename: null } : null, explanation: set.unlocked ? null : CLIP_LOCKED_EXPLANATION, aiGenerated: true }];
}

/** Every tile of the set in reading order: studio, lifestyle, turntable, clip. Empty for no set. */
export function tilesOf(set: MediaSetView | null): readonly Tile[] {
  if (!set) return [];
  return [...studioTiles(set), ...lifestyleTiles(set), ...turntableTile(set), ...clipTile(set)];
}

export type Progress = Readonly<{ ready: number; total: number; done: boolean; text: string }>;

/** How far the pictures of the set are: the studio views and the lifestyle scenes, not the recording or the clip. */
export function progressOf(set: MediaSetView | null): Progress {
  if (!set) return { ready: 0, total: 0, done: false, text: "No pictures yet." };
  const counted = tilesOf(set).filter((tile) => tile.group === "studio" || tile.group === "lifestyle");
  const readyCount = counted.filter((tile) => tile.state === "ready").length;
  if (set.status === "failed") return { ready: readyCount, total: counted.length, done: true, text: set.error ?? "The media could not be made. Nothing was charged. Try again." };
  return { ready: readyCount, total: counted.length, done: set.status === "succeeded", text: `${readyCount} of ${counted.length} pictures ready.` };
}

type ClipPlan = Readonly<{ enabled: boolean; view: "scene" | "on_model" | null; reason: string | null }>;

const CLIP_VIEWS: readonly MediaView[] = ["on_model", "scene"];

/** Whether the clip button works, and why not. Mirrors the server's own rule (lib/media/video/clip.ts), which stays the authority. */
export function clipPlan(set: MediaSetView | null): ClipPlan {
  if (!set || set.status !== "succeeded") return { enabled: false, view: null, reason: CLIP_WAIT };
  const still = set.items.find((entry) => entry.kind === "lifestyle" && entry.checker === "passed" && CLIP_VIEWS.includes(entry.view));
  if (!still || (still.view !== "scene" && still.view !== "on_model")) return { enabled: false, view: null, reason: NEEDS_MATCHING_STILL };
  if (set.items.some((entry) => entry.kind === "clip" && entry.view === still.view)) return { enabled: false, view: still.view, reason: CLIP_EXISTS };
  return { enabled: true, view: still.view, reason: null };
}

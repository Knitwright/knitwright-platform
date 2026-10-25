"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { RECORDING_LABEL } from "@/lib/media/video/copy";
import {
  CLIP_LABEL,
  CLIP_NOTE,
  EMPTY_MESSAGE,
  LOADING_MESSAGE,
  MAKE_LABEL,
  MAKING_CLIP_LABEL,
  MAKING_LABEL,
  NO_LIFESTYLE_NOTE,
  PREVIEW_NOTE,
  RECORD_LABEL,
  REMAKE_LABEL,
  TURNTABLE_NOTE,
  USE_CREDITS_LABEL,
  USING_CREDITS_LABEL,
  WORKING_MESSAGE,
  priceText,
} from "./copy";
import { TileCard } from "./TileCard";
import { useMediaScreen } from "./useMediaScreen";

/**
 * The Studio media screen (spec stage 4): make a set, watch it fill in, use credits to get the clean files, record a
 * turntable, make a clip, save or share what is unlocked. One panel of the workspace; every rule is in state.ts,
 * model.ts and the server routes, and this file is markup and wiring only.
 */
export function MediaScreen({ projectId }: Readonly<{ projectId: string }>) {
  const root = useRef<HTMLDivElement>(null);
  const screen = useMediaScreen(projectId, root);
  const { state, credits, tiles, progress, clip } = screen;
  const working = state.phase === "working";
  const hasSet = state.set !== null;
  const unlocked = state.set?.unlocked === true;
  const lifestyleNone = state.phase === "ready" && !tiles.some((tile) => tile.group === "lifestyle");

  return (
    <div ref={root} className="flex flex-col gap-4" data-testid="media-screen" aria-label="Marketing media" role="group">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Media actions">
        <Button type="button" variant="primary" pending={state.busy === "start" || working} disabled={!screen.allowMake} onClick={() => void screen.make()} data-testid="media-make">
          {state.busy === "start" || working ? MAKING_LABEL : hasSet && state.phase !== "failed" ? REMAKE_LABEL : MAKE_LABEL}
        </Button>
        <Button type="button" variant="secondary" pending={state.busy === "unlock"} disabled={!screen.allowUnlock} onClick={() => void screen.unlock()} data-testid="media-unlock">
          {state.busy === "unlock" ? USING_CREDITS_LABEL : USE_CREDITS_LABEL}
        </Button>
        {credits ? (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-chalk" data-testid="media-price">
            {priceText(credits.price, credits.enforced, credits.balance, credits.isPlaceholder)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-x-4 gap-y-2" role="group" aria-label="Video">
        <div className="flex max-w-[16rem] flex-col gap-1">
          <Button type="button" variant="secondary" pending={state.busy === "turntable"} disabled={state.phase !== "ready" || state.busy !== null} onClick={() => void screen.turntable()} data-testid="media-turntable">
            {state.busy === "turntable" ? RECORDING_LABEL : RECORD_LABEL}
          </Button>
          <p className="text-[12px] text-chalk-muted">{TURNTABLE_NOTE}</p>
        </div>
        <div className="flex max-w-[16rem] flex-col gap-1">
          <Button type="button" variant="secondary" pending={state.busy === "clip" || state.awaiting === "clip"} disabled={!clip.enabled || state.busy !== null} onClick={() => void screen.startClip()} data-testid="media-clip">
            {state.busy === "clip" || state.awaiting === "clip" ? MAKING_CLIP_LABEL : CLIP_LABEL}
          </Button>
          <p className="text-[12px] text-chalk-muted" data-testid="media-clip-note">
            {clip.reason ?? CLIP_NOTE}
          </p>
        </div>
      </div>

      {state.phase === "loading" ? <p className="text-[13px] text-chalk-muted">{LOADING_MESSAGE}</p> : null}
      {state.phase === "empty" ? <p className="text-[13px] text-chalk-muted">{EMPTY_MESSAGE}</p> : null}

      {hasSet && state.phase !== "empty" ? (
        <div className="flex flex-col gap-1.5">
          <div role="status" aria-live="polite" className="text-[13px] text-ink-2" data-testid="media-progress">
            {working ? `${WORKING_MESSAGE} ${progress.text}` : progress.text}
          </div>
          {working ? <progress className="h-1.5 w-full accent-[#8296ff]" max={Math.max(progress.total, 1)} value={progress.ready} aria-label="Pictures ready" /> : null}
        </div>
      ) : null}

      {state.message ? (
        <Notice tone={state.message.tone} role={state.message.tone === "warn" ? "alert" : "status"}>
          {state.message.text}
        </Notice>
      ) : null}

      {tiles.length > 0 ? (
        <ul aria-label="Pictures in this set" className="grid grid-cols-2 gap-2 @lg:grid-cols-3" data-testid="media-gallery">
          {tiles.map((tile) => (
            <TileCard key={tile.key} tile={tile} canShare={screen.canShare} busy={state.busy !== null || working} onRerun={() => void screen.make()} onShare={(entry) => void screen.share(entry)} />
          ))}
        </ul>
      ) : null}

      {hasSet && !unlocked && state.phase === "ready" ? <p className="text-[12px] text-chalk-muted">{PREVIEW_NOTE}</p> : null}
      {lifestyleNone ? <p className="text-[12px] text-chalk-muted">{NO_LIFESTYLE_NOTE}</p> : null}
    </div>
  );
}

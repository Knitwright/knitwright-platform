"use client";

import { useEffect, useId, useRef, useState } from "react";
import * as copy from "./copy";
import { applyPlayer, initialPlayer, muteLabel, playerKey, playLabel, scrubTo, timeLabel } from "./player";

/**
 * The player bar of a clip (spec F-L3: "play, scrubber, mute, Flatten, download").
 *
 * The clip never starts on its own with sound: `initialPlayer` is paused and muted, the element
 * carries `muted` and no `autoPlay`. The keyboard does everything the mouse does, and the hint beside
 * the bar says which keys. Flatten and the rest of the board task bar belong to the flows workstream
 * (L6), so they are not drawn a second time here.
 *
 * A stored file is reached through `/api/files/<id>/link`, which hands back a link that stops working
 * after a minute -- the way every other screen reaches a file (`lib/artwork-intake/client.ts`). While
 * the link is being fetched the player says so; if it cannot be fetched it says that too, rather than
 * showing an empty black box.
 */

export type VideoPlayerProps = Readonly<{
  /** The file the board's last run produced. */
  fileId: string;
  seconds: number;
  /** An address to use instead of asking for a link. The end-to-end test passes one. */
  src?: string;
}>;

const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3.5 text-[13px] text-ink";
const HINT = "text-[12px] leading-relaxed text-ink-2";

const FETCHING = "Fetching the clip…";
const NO_LINK = "The clip could not be fetched just now. Reload the page and try again.";

/** The short-lived address of the stored clip, or an honest line about why there is none. */
function useClipAddress(fileId: string, given: string | undefined): Readonly<{ src: string | null; line: string | null }> {
  const [fetched, setFetched] = useState<Readonly<{ src: string | null; line: string | null }> | null>(null);
  useEffect(() => {
    if (given) return;
    let live = true;
    void fetch(`/api/files/${fileId}/link`, { cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as { data?: { url?: string } }) : null))
      .then((body) => {
        if (!live) return;
        const url = body?.data?.url;
        setFetched(url ? { src: url, line: null } : { src: null, line: NO_LINK });
      })
      .catch(() => {
        if (live) setFetched({ src: null, line: NO_LINK });
      });
    return () => {
      live = false;
    };
  }, [fileId, given]);
  if (given) return { src: given, line: null };
  return fetched ?? { src: null, line: FETCHING };
}

export function VideoPlayer({ fileId, seconds, src }: VideoPlayerProps) {
  const element = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState(() => initialPlayer(seconds * 1000));
  const scrubberId = useId();
  const address = useClipAddress(fileId, src);

  useEffect(() => {
    const video = element.current;
    if (!video) return;
    video.muted = state.muted;
    if (Math.abs(video.currentTime * 1000 - state.atMs) > 250) video.currentTime = state.atMs / 1000;
    if (state.playing) void video.play().catch(() => setState((was) => ({ ...was, playing: false })));
    else video.pause();
  }, [state]);

  return (
    <section aria-label={copy.PLAYER_HEADING} className="flex flex-col gap-2" data-testid="video-player">
      <h4 className="text-[13px] font-medium text-ink">{copy.PLAYER_HEADING}</h4>
      {address.src === null ? (
        <p role="status" className={HINT} data-testid="video-player-status">
          {address.line}
        </p>
      ) : (
        <>
          {/* A kit clip carries no speech, so there is nothing to caption; its only sound is music a model made. */}
          <video
            ref={element}
            src={address.src}
            muted
            playsInline
            preload="metadata"
            tabIndex={0}
            className="w-full rounded-2xl border border-white/10 bg-black"
            onTimeUpdate={(event) => setState((was) => ({ ...was, atMs: event.currentTarget.currentTime * 1000 }))}
            onEnded={() => setState((was) => ({ ...was, playing: false }))}
            onKeyDown={(event) => {
              const command = playerKey(event.key);
              if (!command) return;
              event.preventDefault();
              setState((was) => applyPlayer(was, command));
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setState((was) => applyPlayer(was, "toggle"))} className={CHIP} data-testid="video-play">
              {playLabel(state)}
            </button>
            <label htmlFor={scrubberId} className="sr-only">
              Position in the clip
            </label>
            <input
              id={scrubberId}
              type="range"
              min={0}
              max={state.durationMs}
              step={100}
              value={state.atMs}
              aria-valuetext={timeLabel(state)}
              onChange={(event) => setState((was) => scrubTo(was, Number(event.target.value)))}
              className="min-w-24 flex-1 accent-cobalt-soft"
              data-testid="video-scrubber"
            />
            <span className="text-[12px] tabular-nums text-ink-2">{timeLabel(state)}</span>
            <button type="button" aria-pressed={state.muted} onClick={() => setState((was) => applyPlayer(was, "mute"))} className={CHIP} data-testid="video-mute">
              {muteLabel(state)}
            </button>
            <a href={address.src} download className={CHIP} data-testid="video-download">
              {copy.DOWNLOAD_LABEL}
            </a>
          </div>
        </>
      )}
      <p className={HINT}>{copy.PLAYER_HINT}</p>
      <p className={`flex flex-wrap items-center gap-2 ${HINT}`}>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-ink" data-testid="video-ai-label">
          {copy.GENERATED_BADGE}
        </span>
        {copy.GENERATED_BADGE_LINE}
      </p>
    </section>
  );
}

"use client";

import { AI_BADGE, CLEAN_BADGE, DOWNLOAD_LABEL, PREVIEW_BADGE, RERUN_LABEL, SHARE_LABEL } from "./copy";
import type { Tile, Tone } from "./model";

type TileCardProps = Readonly<{
  tile: Tile;
  /** True where the browser can share a file. */
  canShare: boolean;
  busy: boolean;
  onRerun: () => void;
  onShare: (tile: Tile) => void;
}>;

const TONES: Readonly<Record<Tone, string>> = {
  ok: "bg-ok-wash text-ok",
  warn: "bg-warn-wash text-warn",
  neutral: "bg-white/10 text-chalk",
};

const ACTION = "inline-flex h-8 items-center rounded-full border border-white/20 bg-white/[0.04] px-3 text-[12px] text-ink hover:bg-white/10 disabled:opacity-55";

const altOf = (tile: Tile): string => (tile.watermarked ? `${tile.label}, preview with a Knitwright mark` : tile.label);

function Picture({ tile }: Readonly<{ tile: Tile }>) {
  if (tile.videoHref) {
    return (
      <video className="size-full object-contain" controls preload="none" poster={tile.imageHref ?? undefined} src={tile.videoHref} aria-label={`${tile.label}${tile.aiGenerated ? ", AI generated" : ""}`} />
    );
  }
  if (tile.imageHref && tile.state === "ready") {
    // eslint-disable-next-line @next/next/no-img-element -- a members-only API address that the server answers per request
    return <img className="size-full object-contain" src={tile.imageHref} alt={altOf(tile)} loading="lazy" decoding="async" />;
  }
  const text = tile.state === "waiting" ? "Making…" : tile.state === "missing" ? "Dropped" : "Not shown";
  return (
    <span className="grid size-full place-items-center text-[12px] text-chalk-muted" aria-hidden={tile.state === "waiting" ? undefined : true}>
      {text}
    </span>
  );
}

/** One picture or video of the set, with its state, its verdict in words and the actions that fit. Markup only; the logic is in model.ts. */
export function TileCard({ tile, canShare, busy, onRerun, onShare }: TileCardProps) {
  const badge = tile.aiGenerated ? AI_BADGE : tile.state === "ready" ? (tile.watermarked ? PREVIEW_BADGE : CLEAN_BADGE) : null;
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-2xl border border-white/14 bg-white/[0.04] p-2" data-testid="media-tile" data-group={tile.group} data-state={tile.state} data-watermarked={tile.watermarked}>
      <div className="tile-dots relative aspect-square overflow-hidden rounded-xl">
        <Picture tile={tile} />
        {badge ? <span className="absolute top-1.5 left-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-chalk backdrop-blur-md">{badge}</span> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 px-1">
        <p className="text-[13px] font-medium text-ink">{tile.label}</p>
        {tile.verdict.text ? <span className={`rounded-full px-2 py-0.5 text-[11px] ${TONES[tile.verdict.tone]}`}>{tile.verdict.text}</span> : null}
      </div>
      {tile.explanation ? <p className="px-1 text-[12px] leading-relaxed text-chalk-muted">{tile.explanation}</p> : null}
      {tile.download || tile.canRerun ? (
        <div className="flex flex-wrap gap-1.5 px-1 pb-1">
          {tile.download ? (
            <a className={ACTION} href={tile.download.href} download={tile.download.filename ?? ""} aria-label={`${DOWNLOAD_LABEL} ${tile.label}`}>
              {DOWNLOAD_LABEL}
            </a>
          ) : null}
          {tile.download?.filename && canShare ? (
            <button type="button" className={ACTION} onClick={() => onShare(tile)} aria-label={`${SHARE_LABEL} ${tile.label}`}>
              {SHARE_LABEL}
            </button>
          ) : null}
          {tile.canRerun ? (
            <button type="button" className={ACTION} onClick={onRerun} disabled={busy} aria-label={`${RERUN_LABEL}: ${tile.label}`}>
              {RERUN_LABEL}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

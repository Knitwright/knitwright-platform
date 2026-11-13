"use client";

import { ImagePlus, Sparkles, Star, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { MAX_MEDIA, type MediaItem } from "@/lib/storefront/listing";
import { EditorCard } from "./parts";

/**
 * MOCKUPS (09 screen 23; prototype p06 and p07): a primary tile over two rows, the picked pictures, and three doors:
 * the Mockup library modal (the pool of this design's render and hand-offs), AI scene (the try-on workflows, which
 * hand their pictures back here) and Upload (Mockup studio, which does the same). Nothing else can be picked.
 */

type Props = Readonly<{
  media: readonly MediaItem[];
  pool: readonly MediaItem[];
  sources: Readonly<Record<string, string>>;
  canEdit: boolean;
  onToggle: (item: MediaItem) => void;
  onPrimary: (id: string) => void;
}>;

function Picture({ item, src, primary }: Readonly<{ item: MediaItem; src: string | undefined; primary?: boolean }>) {
  return (
    <span className="relative grid size-full place-items-center overflow-hidden rounded-lg bg-soft">
      {/* eslint-disable-next-line @next/next/no-img-element -- A render made on the server or a short-lived storage link. */}
      {src ? <img src={src} alt={item.label} className="max-h-full max-w-full object-contain" /> : <span className="px-2 text-center text-caption text-muted">{item.label}</span>}
      {primary ? <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-xs border border-border bg-bg px-1.5 py-0.5 text-caption font-semibold text-text"><Icon icon={Star} size={14} />Primary</span> : null}
      {item.aiLabel ? <span className="absolute right-2 bottom-2 rounded-xs bg-navy px-1.5 py-0.5 text-micro text-on-dark">{item.aiLabel}</span> : null}
    </span>
  );
}

const TILE = "flex aspect-square items-center justify-center gap-2 rounded-lg border border-border bg-bg text-body font-semibold text-text live:hover:bg-soft";

export function MockupsSection({ media, pool, sources, canEdit, onToggle, onPrimary }: Props) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = media;
  return (
    <EditorCard id="mockups" title="Mockups" meta={`${media.length} of ${MAX_MEDIA} selected · the first is the primary`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 row-span-2 aspect-square">
          {first ? <Picture item={first} src={sources[first.id]} primary /> : <span className="grid size-full place-items-center rounded-lg border border-dashed border-border-strong text-body text-muted">No mockup picked yet</span>}
        </div>
        {rest.slice(0, 3).map((item) => (
          <button key={item.id} type="button" disabled={!canEdit} onClick={() => onPrimary(item.id)} aria-label={`Make ${item.label} the primary mockup`} className="aspect-square rounded-lg">
            <Picture item={item} src={sources[item.id]} />
          </button>
        ))}
        <button type="button" className={TILE} onClick={() => setOpen(true)} disabled={!canEdit}>
          <Icon icon={ImagePlus} size={20} />
          Mockup library
        </button>
        <Link href="/ai-studio/workflows" className={cx(TILE, "border-info-soft bg-info-soft text-info no-underline")}>
          <Icon icon={Sparkles} size={20} />
          AI scene
        </Link>
        <Link href="/mockups" className={cx(TILE, "no-underline")}>
          <Icon icon={Upload} size={20} />
          Upload
        </Link>
      </div>
      {rest.length > 3 ? <p className="text-small text-muted">And {rest.length - 3} more. Choose a picture to make it the primary.</p> : null}
      <MockupLibrary open={open} onClose={() => setOpen(false)} pool={pool} media={media} sources={sources} onToggle={onToggle} />
    </EditorCard>
  );
}

function MockupLibrary({ open, onClose, pool, media, sources, onToggle }: Readonly<{ open: boolean; onClose: () => void; pool: readonly MediaItem[]; media: readonly MediaItem[]; sources: Readonly<Record<string, string>>; onToggle: (item: MediaItem) => void }>) {
  const picked = new Set(media.map((item) => item.id));
  return (
    <Modal open={open} onClose={onClose} title="Mockup library" size="lg" footer={<Button onClick={onClose}>Add to listing</Button>}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-muted">
          Selected ({media.length}/{MAX_MEDIA}). The product render is drawn by Knitwright and is true to colour. Pictures from Mockup studio and Flow runs appear here once handed over with
          &ldquo;Publish to store&rdquo;; anything a model made says so.
        </p>
        {pool.length === 0 ? (
          <p className="rounded-lg bg-soft p-4 text-body text-muted">No pictures yet. Make some in Mockups or an AI Studio workflow and hand them over to the store.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Pictures you can use">
            {pool.map((item) => {
              const on = picked.has(item.id);
              return (
                <li key={item.id}>
                  <label className={cx("flex cursor-pointer flex-col gap-2 rounded-lg border p-2", on ? "border-navy" : "border-border")}>
                    <span className="aspect-square">
                      <Picture item={item} src={sources[item.id]} />
                    </span>
                    <span className="flex items-center gap-2 text-small text-text">
                      <input type="checkbox" checked={on} onChange={() => onToggle(item)} disabled={!on && media.length >= MAX_MEDIA} />
                      {item.label}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

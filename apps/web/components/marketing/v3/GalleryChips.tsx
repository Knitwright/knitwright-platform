"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "@/components/ui/Menu";
import { cx } from "@/components/ui/cx";
import { GALLERY_KINDS, GALLERY_KIND_LABELS, GROUP_CHOICES, galleryHref, type GalleryFilter } from "@/lib/marketing/gallery/concepts";
import { GROUP_LABELS } from "@/lib/marketing/templates/types";

/**
 * The Ad gallery's chips (09 screen 9): All · Photo · Video, then Concepts ▾ and Sport ▾. Every
 * choice is in the address, so a link opens the same gallery. Sport changes the garment every
 * card shows to a starter of that sport; it never hides a concept, because a concept is for any sport.
 */

const CHIP = "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-small font-medium whitespace-nowrap no-underline transition-colors duration-fast";

type ChipsProps = Readonly<{ filter: GalleryFilter; sports: readonly Readonly<{ id: string; label: string }>[] }>;

export function GalleryChips({ filter, sports }: ChipsProps) {
  const router = useRouter();
  const go = (next: GalleryFilter) => router.push(galleryHref(next) as Route);
  const sportLabel = sports.find((one) => one.id === filter.sport)?.label;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter the ad gallery">
      {GALLERY_KINDS.map((kind) => (
        <Link
          key={kind}
          href={galleryHref({ ...filter, kind }) as Route}
          aria-current={filter.kind === kind ? "true" : undefined}
          className={cx(CHIP, filter.kind === kind ? "border-navy bg-navy text-on-dark" : "border-border bg-bg text-text-2 live:hover:bg-soft")}
        >
          {GALLERY_KIND_LABELS[kind]}
        </Link>
      ))}
      <Menu
        label={filter.group === null ? "Concepts" : `Concepts: ${GROUP_LABELS[filter.group]}`}
        size="sm"
        className="rounded-full"
        items={[{ id: "any", label: "Every concept", onSelect: () => go({ ...filter, group: null }) }, ...GROUP_CHOICES.map((one) => ({ id: one.id, label: one.label, onSelect: () => go({ ...filter, group: one.id }) }))]}
      />
      <Menu
        label={sportLabel === undefined ? "Sport" : `Sport: ${sportLabel}`}
        size="sm"
        className="rounded-full"
        items={[{ id: "any", label: "My own kit", onSelect: () => go({ ...filter, sport: null }) }, ...sports.map((one) => ({ id: one.id, label: one.label, onSelect: () => go({ ...filter, sport: one.id }) }))]}
      />
    </div>
  );
}

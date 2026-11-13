"use client";

import { FileText, Grid3x3, ImagePlus, Layers, Library, MessageCircle, Palette, PaintBucket, Shield, Sparkles, Tag, Upload, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { RailSegments } from "@/components/studio/editor/RailSegments";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { PremiumMark } from "@/components/ui/Marks";
import type { RailSegment } from "@/lib/editor";
import { initialsOf } from "@/lib/garment-studio/library";
import { SHELF_GROUPS, type ShelfEntry, type ShelfGroup, type ShelfIcon, type ShelfId } from "@/lib/garment-studio/shelves";

const GLYPHS: Readonly<Record<ShelfIcon, LucideIcon>> = {
  layers: Layers,
  paint: PaintBucket,
  grid: Grid3x3,
  image: ImagePlus,
  tag: Tag,
  palette: Palette,
  shield: Shield,
  upload: Upload,
  sparkles: Sparkles,
};

type Props = Readonly<{
  projectId: string;
  clubName: string;
  shelf: ShelfId | null;
  onShelf: (shelf: ShelfId) => void;
  segment: RailSegment | null;
  onSegment: (segment: RailSegment) => void;
  onAssistant: () => void;
  assistantOpen: boolean;
}>;

/**
 * THE LIBRARY COLUMN (plan v6 G1, decision 0150; `08` v3.6, s02; 236 px): the Library / Tech pack
 * switch, the editor's three toolbars, the Knitwright library, the club's library and the tools,
 * then Ask Knitwright. Each library entry opens its panel beside the column; pressing the open one
 * again leaves it open (the panel's × closes it).
 *
 * "Tech pack" is the design's tech pack page (`/studio/<id>/tech-pack`, G2's view): a link, so it
 * keeps the address every earlier link to the factory file uses.
 */
export function LibraryColumn(props: Props) {
  return (
    <nav aria-label="Garment Studio library" className="flex min-h-0 flex-col gap-4 overflow-y-auto border-border bg-bg p-4 lg:border-r" data-testid="studio-library-column">
      <ModeSwitch projectId={props.projectId} />
      <div className="flex flex-col gap-2">
        <h2 className="px-2 text-micro text-muted uppercase">Edit this design</h2>
        <RailSegments segment={props.segment} onChoose={props.onSegment} />
      </div>
      {SHELF_GROUPS.map((group) => (
        <Group key={group.id} group={group} clubName={props.clubName} shelf={props.shelf} onShelf={props.onShelf} />
      ))}
      <button
        type="button"
        onClick={props.onAssistant}
        aria-expanded={props.assistantOpen}
        aria-controls="assistant-panel"
        className="mt-auto flex min-h-10 items-center gap-3 rounded-md border border-border px-3 text-body-lg text-text live:hover:bg-soft"
        data-testid="studio-ask"
      >
        <Icon icon={MessageCircle} size={20} />
        Ask Knitwright
      </button>
    </nav>
  );
}

/** Library | Tech pack, Fabra's switch at the top of the column. */
function ModeSwitch({ projectId }: Readonly<{ projectId: string }>) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-soft p-1" role="group" aria-label="Library or tech pack">
      <span aria-current="true" className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-navy px-3 text-small font-semibold text-on-dark">
        <Icon icon={Library} size={16} />
        Library
      </span>
      <Link
        href={`/studio/${encodeURIComponent(projectId)}/tech-pack` as Route}
        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full px-3 text-small font-semibold text-text no-underline live:hover:bg-bg"
        data-testid="studio-tech-pack-link"
      >
        <Icon icon={FileText} size={16} />
        Tech pack
      </Link>
    </div>
  );
}

type GroupProps = Readonly<{ group: ShelfGroup; clubName: string; shelf: ShelfId | null; onShelf: (shelf: ShelfId) => void }>;

function Group({ group, clubName, shelf, onShelf }: GroupProps) {
  const heading = group.id === "yours" ? `${group.label}: ${clubName}` : group.label;
  return (
    <section aria-label={heading} className="flex flex-col gap-0.5" data-testid={`studio-group-${group.id}`}>
      <h2 className="px-2 pb-1 text-small font-medium text-muted">{group.label}</h2>
      {group.id === "yours" ? (
        <p className="flex min-h-10 items-center gap-3 px-2 text-body font-semibold text-text">
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-sm bg-navy text-caption font-bold text-gold">
            {initialsOf(clubName)}
          </span>
          <span className="truncate">{clubName}</span>
        </p>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {group.entries.map((entry) => (
          <li key={entry.id}>
            <EntryButton entry={entry} open={entry.id === shelf} onShelf={onShelf} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EntryButton({ entry, open, onShelf }: Readonly<{ entry: ShelfEntry; open: boolean; onShelf: (shelf: ShelfId) => void }>) {
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-controls="studio-shelf"
      onClick={() => onShelf(entry.id)}
      data-testid={`studio-shelf-${entry.id}`}
      className={cx(
        "flex min-h-10 w-full items-center gap-3 rounded-md px-2 text-left text-body-lg font-medium transition-colors duration-fast",
        open ? "bg-soft text-text" : "text-text-2 live:hover:bg-soft",
      )}
    >
      <Icon icon={GLYPHS[entry.icon]} size={20} />
      <span className="flex-1">{entry.label}</span>
      {entry.premium ? <PremiumMark label="Premium tool" /> : null}
    </button>
  );
}

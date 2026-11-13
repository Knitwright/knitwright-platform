"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import RepeatMaker from "@/components/studio/editor/repeat-maker";
import type { EditorSlotProps } from "@/lib/editor";
import type { ClubLibrary } from "@/lib/garment-studio/library";
import type { ToolId } from "@/lib/workspace/tools";
import { Empty, Said, ShelfSection, Swatch, TargetPicker, useApply } from "./ShelfParts";

/**
 * The club's own library and the tools (plan v6 G1, decision 0150; `08` v3.6). The palettes and
 * uploads are Brand Studio's (decision 0042), read on the server; what the club has not got yet
 * says so and links to Brand, where it is added. Nothing is invented to fill a panel.
 */

type ClubProps = EditorSlotProps & Readonly<{ club: ClubLibrary; onTool: (tool: ToolId) => void }>;

const NOTHING_YET = "Your club has none on file yet.";

/** The club's own fabrics and repeats: Brand Studio holds neither yet. */
export function NotHeldYet({ what }: Readonly<{ what: string }>) {
  return (
    <Empty href="/brand" link="Open Brand">
      Your club&apos;s own {what} are coming to Brand Studio. Until then, use the Knitwright library.
    </Empty>
  );
}

/** The club's palettes, each colour applied like a print-safe one. */
export function PalettesShelf(slot: ClubProps) {
  const applier = useApply(slot);
  if (slot.club.palettes.length === 0) {
    return (
      <Empty href="/brand" link="Add a palette">
        {NOTHING_YET}
      </Empty>
    );
  }
  return (
    <>
      <TargetPicker applier={applier} busy={slot.design.busy} />
      <Said applier={applier} />
      {slot.club.palettes.map((palette) => (
        <ShelfSection key={palette.id} title={palette.name}>
          <ul className="grid grid-cols-6 gap-2">
            {palette.colours.map((item) => (
              <Swatch key={item.id} item={item} busy={slot.design.busy} onApply={applier.apply} />
            ))}
          </ul>
        </ShelfSection>
      ))}
    </>
  );
}

/** The brand kit at a glance: how many palettes and pictures, and the page that edits them. */
export function BrandKitShelf({ club }: ClubProps) {
  return (
    <ShelfSection title={club.name}>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-small">
        <dt className="text-muted">Palettes</dt>
        <dd className="text-right tabular-nums text-text">{club.palettes.length}</dd>
        <dt className="text-muted">Colours</dt>
        <dd className="text-right tabular-nums text-text">{club.palettes.reduce((sum, palette) => sum + palette.colours.length, 0)}</dd>
        <dt className="text-muted">Crests, logos and pictures</dt>
        <dd className="text-right tabular-nums text-text">{club.uploads.length}</dd>
      </dl>
      <Empty href="/brand" link="Edit the brand kit">
        Fonts, colours and crests are kept in Brand.
      </Empty>
    </ShelfSection>
  );
}

/** The club's uploads. Putting one on the design is the Logos panel's job, which keeps the rights tick. */
export function UploadsShelf({ club, onTool }: ClubProps) {
  return (
    <>
      {club.uploads.length === 0 ? (
        <Empty href="/brand" link="Upload in Brand">
          {NOTHING_YET}
        </Empty>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="studio-uploads">
          {club.uploads.map((upload) => (
            <li key={upload.id} className="flex min-h-10 items-center justify-between gap-2 rounded-md bg-soft px-3 text-small">
              <span className="truncate text-text">{upload.label}</span>
              <span className="shrink-0 text-caption text-muted">{upload.kind}</span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" icon={<Icon icon={Plus} size={20} />} onClick={() => onTool("logos")}>
        Put a picture on this design
      </Button>
    </>
  );
}

/** Repeat prints ♛: the repeat maker (Y8), which the Library toolbar also draws under its pattern fills. */
export function RepeatPrintsShelf(slot: EditorSlotProps) {
  return <RepeatMaker {...slot} />;
}

export function TrimGeneratorShelf() {
  return <Empty>Coming soon: a woven label or a sleeve badge made from your crest, in the trims the factory stocks.</Empty>;
}

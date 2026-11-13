"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { EditorSlotProps } from "@/lib/editor";
import type { ClubLibrary } from "@/lib/garment-studio/library";
import { shelfEntry, type ShelfId } from "@/lib/garment-studio/shelves";
import type { ToolId } from "@/lib/workspace/tools";
import { BrandKitShelf, NotHeldYet, PalettesShelf, RepeatPrintsShelf, TrimGeneratorShelf, UploadsShelf } from "./ClubShelves";
import { ColoursShelf, FabricsShelf, GraphicsShelf, RepeatsShelf, TrimsShelf } from "./KnitwrightShelves";

type Props = Readonly<{
  shelf: ShelfId;
  slot: EditorSlotProps;
  club: ClubLibrary;
  onTool: (tool: ToolId) => void;
  onClose: () => void;
}>;

/**
 * THE LIBRARY PANEL (plan v6 G1, decision 0150; `08` v3.6, s02, s04–s07; 380 px): the open library
 * entry's panel, with its title and ×. Closing it shows the editor's open toolbar again.
 */
export function ShelfPanel({ shelf, slot, club, onTool, onClose }: Props) {
  const entry = shelfEntry(shelf);
  return (
    <section id="studio-shelf" aria-labelledby="studio-shelf-title" className="flex min-h-0 flex-col border-border bg-bg lg:border-r" data-testid={`studio-panel-${shelf}`}>
      <header className="flex items-center justify-between gap-2 px-4.5 pt-4 pb-2">
        <h2 id="studio-shelf-title" className="text-h3 text-text">
          {entry.title}
        </h2>
        <Button variant="ghost" iconOnly aria-label={`Close ${entry.title}`} icon={<Icon icon={X} size={20} />} onClick={onClose} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4.5 pb-6">
        <Body shelf={shelf} slot={slot} club={club} onTool={onTool} />
      </div>
    </section>
  );
}

function Body({ shelf, slot, club, onTool }: Omit<Props, "onClose">) {
  const props = { ...slot, onTool };
  switch (shelf) {
    case "fabrics":
      return <FabricsShelf {...props} />;
    case "colours":
      return <ColoursShelf {...props} club={club} />;
    case "repeats":
      return <RepeatsShelf {...props} />;
    case "graphics":
      return <GraphicsShelf {...props} />;
    case "trims":
      return <TrimsShelf {...props} />;
    case "own-fabrics":
      return <NotHeldYet what="fabrics" />;
    case "own-repeats":
      return <NotHeldYet what="repeats" />;
    case "palettes":
      return <PalettesShelf {...props} club={club} />;
    case "brand-kit":
      return <BrandKitShelf {...props} club={club} />;
    case "uploads":
      return <UploadsShelf {...props} club={club} />;
    case "repeat-prints":
      return <RepeatPrintsShelf {...slot} />;
    default:
      return <TrimGeneratorShelf />;
  }
}

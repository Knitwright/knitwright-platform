import { GeneratorGallery } from "@/components/artwork/generators/GeneratorGallery";
import type { GalleryTile } from "@/lib/pattern-generators/gallery";
import { lookNote } from "./pattern-looks";

type LooksProps = Readonly<{
  /** One small drawing of each style and preset, in the club's colours (`galleryTiles`). */
  tiles: readonly GalleryTile[];
  /** The kit styles this garment offers, which is what the gallery above is drawn from. */
  offered: readonly string[];
}>;

/**
 * EVERY PATTERN THE PLATFORM CAN DRAW (plan W7c: "Gallery component for the editor"; decision
 * 0037), under the kit styles a person can pick for this garment.
 *
 * The pictures are for choosing a look. Each one says plainly what can be done with it today: the
 * eight older kit styles are picked from the gallery above, drawn on the real garment, and the nine
 * newer styles can be drawn but not yet stored on a design. Saying so under each picture is the
 * point of showing them: it is the difference between a library and a promise.
 */
export function PatternLooks({ tiles, offered }: LooksProps) {
  return (
    <section aria-labelledby="pattern-looks" className="flex flex-col gap-4" data-testid="pattern-looks">
      <header className="flex flex-col gap-2">
        <h2 id="pattern-looks" className="text-xl font-semibold tracking-tight text-ink">
          Every pattern we can draw
        </h2>
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
          {tiles.length} looks in your club&apos;s colours, three settings of each style. The pictures are swatches for choosing a
          look, not drawings of your garment: the size, the spacing and the colours are all changed afterwards.
        </p>
      </header>
      <GeneratorGallery
        tiles={tiles}
        action={(tile) => {
          const note = lookNote(tile.generatorId, offered);
          return (
            <p className="text-xs leading-relaxed text-muted">
              {note.text} <span className="font-mono text-[10px] tracking-[0.08em] text-faint">{note.ruleId}</span>
            </p>
          );
        }}
      />
    </section>
  );
}

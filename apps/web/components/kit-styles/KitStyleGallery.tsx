import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { GalleryFrom, KitStyleTile } from "@/lib/kit-styles/gallery";
import { CLUB_PALETTE, type ClubColours } from "@/lib/kit-styles/presets";
import { KitStylePick } from "./KitStylePick";

type GalleryProps = Readonly<{
  projectId: string;
  version: number;
  typeLabel: string;
  tiles: readonly KitStyleTile[];
  colours: ClubColours;
  from: GalleryFrom;
  /** Where "Back" goes without picking anything. */
  backHref: Route;
}>;

type Slot = Readonly<{ name: "main" | "second" | "third"; legend: string; chosen: string | null; optional: boolean }>;

/** One row of colour chips. Each is a radio button with its name, so it works with a keyboard and a screen reader. */
function ColourRow({ slot }: Readonly<{ slot: Slot }>) {
  const choices = [...(slot.optional ? [{ name: "None", swatch: "none" }] : []), ...CLUB_PALETTE];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">{slot.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => {
          const id = `${slot.name}-${choice.swatch.replace("#", "")}`;
          const checked = (slot.chosen ?? "none") === choice.swatch;
          return (
            <label
              key={id}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-hairline bg-surface py-1 pl-1 pr-3 text-sm text-ink-2 has-[:checked]:border-cobalt has-[:checked]:bg-cobalt-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cobalt"
            >
              <input id={id} type="radio" name={slot.name} value={choice.swatch} defaultChecked={checked} className="sr-only" />
              <span
                aria-hidden="true"
                className="inline-block size-5 rounded-full border border-hairline"
                style={choice.swatch === "none" ? undefined : { backgroundColor: choice.swatch }}
              />
              {choice.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The kit style gallery: the club's colours, then one small drawing of this design in each
 * style. Changing the colours redraws the tiles (a plain form, no script needed). Picking a
 * tile puts that style on the design as one change, which one undo takes back.
 */
export function KitStyleGallery({ projectId, version, typeLabel, tiles, colours, from, backHref }: GalleryProps) {
  const slots: readonly Slot[] = [
    { name: "main", legend: "Main colour, for the body and sleeves", chosen: colours.main, optional: false },
    { name: "second", legend: "Second colour, for the pattern and trims", chosen: colours.second, optional: false },
    { name: "third", legend: "Third colour, if the pattern has one", chosen: colours.third, optional: true },
  ];
  return (
    <div className="flex flex-col gap-8" data-testid="kit-style-gallery">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Choose a kit style</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Starting points for your {typeLabel.toLowerCase()} in your club&apos;s colours. Pick one and change anything after. The
          colours here are screen colours; add the colour references your factory matches in the editor.
        </p>
      </header>
      <form method="get" className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-6">
        <input type="hidden" name="from" value={from} />
        {slots.map((slot) => (
          <ColourRow key={slot.name} slot={slot} />
        ))}
        <div>
          <Button type="submit" variant="secondary">
            Show in these colours
          </Button>
        </div>
      </form>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Kit styles">
        {tiles.map((tile) => (
          <li
            key={tile.id}
            className={`flex flex-col gap-3 rounded-2xl border bg-surface p-3 ${tile.current ? "border-cobalt" : "border-hairline"}`}
            data-testid={`kit-style-${tile.id}`}
          >
            {/* A data address cannot go through next/image, and this is a drawing, not a photo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tile.src} alt={tile.alt} className="mx-auto h-auto max-h-48 w-full object-contain" />
            <div>
              <p className="text-[15px] font-semibold text-ink">
                {tile.label}
                {tile.current ? <span className="ml-2 text-sm font-normal text-cobalt">Now</span> : null}
              </p>
              <p className="text-sm text-muted">{tile.hint}</p>
            </div>
            <KitStylePick
              projectId={projectId}
              version={version}
              styleId={tile.id}
              label={tile.label}
              colours={colours}
              from={from}
              current={tile.current}
            />
          </li>
        ))}
      </ul>
      <div>
        <Link href={backHref} className="text-[15px] font-medium text-cobalt underline-offset-4 hover:underline">
          Back without changing the style
        </Link>
      </div>
    </div>
  );
}

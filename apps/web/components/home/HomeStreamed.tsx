import { JourneyChip } from "@/components/ui/JourneyChip";
import type { HomeDetails } from "@/lib/home/details";
import { GarmentOutline } from "./GarmentOutline";
import { NeedsYouPanel } from "./NeedsYouPanel";

/**
 * The parts of the studio home that wait for the slower reads. The page is drawn without them
 * first; each one fills in when the reads are done.
 */

type Details = Readonly<{ details: Promise<HomeDetails> }>;

export async function StreamedNeedsYou({ details }: Details) {
  return <NeedsYouPanel needs={(await details).needsYou} />;
}

/** The front of a design's drawing, or a plain outline when its garment has no drawing. */
export async function StreamedCardArt({ details, id }: Details & Readonly<{ id: string }>) {
  const thumbnail = (await details).cards.get(id)?.thumbnail;
  return thumbnail ? (
    // A data address made on the server, shown as a picture so nothing in it can run. The card names the design, so the drawing is decoration.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumbnail.src} alt="" className="lift-art h-24 w-auto sm:h-32 max-w-full object-contain" />
  ) : (
    <GarmentOutline />
  );
}

/** The step a design has reached. A design that could not be read is at the first step. */
export async function StreamedCardStep({ details, id }: Details & Readonly<{ id: string }>) {
  return <JourneyChip step={(await details).cards.get(id)?.step ?? "design"} />;
}

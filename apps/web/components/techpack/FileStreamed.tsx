import { DesignLeads } from "@/components/leads/DesignLeads";
import type { LoadedIllustrations } from "@/lib/images/illustrations";
import type { DesignLeads as LeadsData } from "@/lib/leads/service";
import type { TechPackPictures } from "@/lib/projects/tech-pack-data";
import { FlatPictures } from "./CoverAndFlats";
import { IllustrationsSection } from "./Illustrations";
import { ColourwayDrawing } from "./OtherViews";

/**
 * The parts of the factory file that wait for stored pictures or other slower reads. The rest of
 * the file is sent first; each of these fills in when its reads are done.
 */

type Pictures = Readonly<{ pictures: Promise<TechPackPictures> }>;

export async function StreamedFlatPictures({ pictures }: Pictures) {
  const { flats, picturesNote } = await pictures;
  return <FlatPictures pictures={flats} picturesNote={picturesNote} />;
}

export async function StreamedColourwayDrawing({ pictures, colourwayId }: Pictures & Readonly<{ colourwayId: string }>) {
  const { colourwayFlats } = await pictures;
  return <ColourwayDrawing picture={colourwayFlats.find((picture) => picture.colourwayId === colourwayId)} />;
}

type IllustrationsProps = Readonly<{ illustrations: Promise<LoadedIllustrations | null>; currentVersion: number }>;

/** The AI illustrations. Should neither picture be readable, the section says so. */
export async function StreamedIllustrations({ illustrations, currentVersion }: IllustrationsProps) {
  const loaded = await illustrations;
  if (loaded) return <IllustrationsSection loaded={loaded} currentVersion={currentVersion} />;
  return (
    <section aria-labelledby="illustrations-heading" className="grid gap-4">
      <h2 id="illustrations-heading" className="text-lg font-semibold text-ink">
        Illustrations
      </h2>
      <p className="text-sm text-muted">The illustrations could not be shown. Reload the page to try again.</p>
    </section>
  );
}

type QuoteProps = Readonly<{ projectId: string; version: number; leads: Promise<LeadsData> }>;

export async function StreamedQuote({ projectId, version, leads }: QuoteProps) {
  return <DesignLeads projectId={projectId} version={version} data={await leads} />;
}

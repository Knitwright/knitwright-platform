import { Suspense, type ReactNode } from "react";
import { Notice } from "@/components/ui/Notice";
import type { TechPackCoreData, TechPackPictures } from "@/lib/projects/tech-pack-data";
import { PRODUCTION_SECTIONS, fileProgress, fileSections, parseSection, type FileSectionId } from "@/lib/projects/tech-pack-sections";
import { ComponentsView, ConstructionView } from "./ComponentViews";
import { ConfirmPanel } from "./ConfirmPanel";
import { ConfirmSummary } from "./ConfirmSummary";
import { CoverView, FlatsView } from "./CoverAndFlats";
import { ComponentForms, LabellingForms, SeamForms } from "./DetailForms";
import { FabricForms } from "./FabricForms";
import { FileHeader } from "./FileHeader";
import { DrawingSkeleton, FlatPicturesSkeleton } from "./FileSkeleton";
import { StreamedColourwayDrawing, StreamedFlatPictures } from "./FileStreamed";
import { FileSummary } from "./FileSummary";
import { FileTabs } from "./FileTabs";
import { FormOpener } from "./FormOpener";
import { HowToMeasureView, MeasurementsView } from "./MeasurementViews";
import { ArtworkView, ColourwaysView, LabellingView, SignOffView, SuggestedView } from "./OtherViews";
import { ArtworkAndColourView, FabricView, OperationsView, PatternAndCuttingView, ReadinessView } from "./ProductionViews";
import { ColourwayForms, CoverForms, MeasurementForms } from "./ValueForms";

type DocumentProps = Readonly<{
  data: TechPackCoreData;
  /** The drawings as pictures. They wait for the artwork's pictures, so they fill in after the rest. */
  pictures: Promise<TechPackPictures>;
  /** The colourway named in the address, so a download is the drawing the page shows. */
  colourwayId?: string | undefined;
  /** The section named in the address. */
  section?: string | readonly string[] | undefined;
  /** The illustrations of the design, or null when none were made. */
  illustrations: ReactNode;
  /** The pattern pieces, made as a DXF file. */
  patterns: ReactNode;
  /** Asking for a quote. */
  quote: ReactNode;
}>;

/** The sections of the document itself, each with its forms and its list of things to confirm. */
function documentPanels(data: TechPackCoreData, pictures: Promise<TechPackPictures>): Partial<Record<FileSectionId, ReactNode>> {
  const { pack, forms, confirmables } = data;
  const confirm = (sectionId: Parameters<typeof ConfirmPanel>[0]["sectionId"]) => <ConfirmPanel sectionId={sectionId} items={confirmables} />;
  const drawings = Object.fromEntries(
    pack.colourways.colourways.map((block) => [
      block.id,
      <Suspense key={block.id} fallback={<DrawingSkeleton className="mb-3 max-w-sm" />}>
        <StreamedColourwayDrawing pictures={pictures} colourwayId={block.id} />
      </Suspense>,
    ]),
  );
  return {
    cover: <CoverView cover={pack.cover} forms={<CoverForms projectId={data.projectId} cover={forms.cover} />} confirm={confirm("cover")} />,
    readiness: <ReadinessView section={pack.readiness} />,
    "pattern-and-cutting": <PatternAndCuttingView section={pack.patternAndCutting} />,
    fabric: <FabricView section={pack.fabric} />,
    "artwork-and-colour": <ArtworkAndColourView section={pack.artworkAndColour} />,
    operations: <OperationsView section={pack.operations} />,
    flats: (
      <FlatsView
        flats={pack.flats}
        pictures={
          <Suspense fallback={<FlatPicturesSkeleton />}>
            <StreamedFlatPictures pictures={pictures} />
          </Suspense>
        }
      />
    ),
    measurements: <MeasurementsView table={pack.measurements} forms={<MeasurementForms rows={forms.measurements} />} confirm={confirm("measurements")} />,
    "how-to-measure": <HowToMeasureView section={pack.howToMeasure} />,
    construction: <ConstructionView section={pack.construction} forms={<SeamForms rows={forms.seams} />} confirm={confirm("construction")} />,
    components: (
      <ComponentsView
        section={pack.components}
        confirm={confirm("components")}
        forms={
          <div className="flex flex-col gap-6">
            <FabricForms fabrics={forms.fabrics} panels={forms.panels} />
            <h3 className="text-sm font-semibold text-ink">Describe rib, thread, labels and trims</h3>
            <ComponentForms rows={forms.components} />
          </div>
        }
      />
    ),
    artwork: <ArtworkView section={pack.artwork} confirm={confirm("artwork")} />,
    labelling: <LabellingView section={pack.labelling} forms={<LabellingForms rows={forms.labelling} />} confirm={confirm("labelling")} />,
    colourways: (
      <ColourwaysView section={pack.colourways} drawings={drawings} forms={<ColourwayForms rows={forms.colourways} />} confirm={confirm("colourways")} />
    ),
    sources: (
      <>
        <SuggestedView section={pack.suggested} />
        <SignOffView section={pack.signOff} />
      </>
    ),
  };
}

const keepColourway = (colourwayId: string | undefined): string => (colourwayId ? new URLSearchParams({ colourway: colourwayId }).toString() : "");

/**
 * The factory file on screen: a header with the downloads, a list of sections with what each still
 * needs, and one section at a time, with the forms to fill in what is missing.
 */
export function TechPackDocument({ data, pictures, colourwayId, section, illustrations, patterns, quote }: DocumentProps) {
  const sections = fileSections(data.report, data.confirmables, { illustrations: illustrations !== null }, data.pack.readiness);
  const available: FileSectionId[] = [...sections.map((entry) => entry.id), "left"];
  const initial = parseSection(section, available);
  const baseSearch = keepColourway(colourwayId);
  const left = sections.filter((entry) => !PRODUCTION_SECTIONS.includes(entry.id)).reduce((sum, entry) => sum + entry.left, 0);
  const panels: Partial<Record<FileSectionId, ReactNode>> = {
    left: (
      <section aria-labelledby="left-title" className="glass flex flex-col gap-4 rounded-3xl p-6">
        <h2 id="left-title" className="text-[26px] font-medium tracking-tight text-ink">
          What is left
        </h2>
        <ConfirmSummary data={data} />
      </section>
    ),
    ...documentPanels(data, pictures),
    illustrations,
    patterns,
    quote: (
      <section aria-labelledby="quote-title" className="glass flex flex-col gap-4 rounded-3xl p-6">
        <h2 id="quote-title" className="text-[26px] font-medium tracking-tight text-ink">
          Request a quote
        </h2>
        {quote}
      </section>
    ),
  };
  return (
    <div className="flex flex-col gap-4">
      <FileHeader data={data} colourwayId={colourwayId} baseSearch={baseSearch} />
      <FormOpener />
      {data.staleNote ? <Notice tone="warn">{data.staleNote}</Notice> : null}
      <FileTabs
        sections={sections}
        initial={initial}
        baseSearch={baseSearch}
        summary={<FileSummary progress={fileProgress(data.pack)} left={left} baseSearch={baseSearch} confirmables={data.confirmables} />}
        panels={panels}
      />
    </div>
  );
}

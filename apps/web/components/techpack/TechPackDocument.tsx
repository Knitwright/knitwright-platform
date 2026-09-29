import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import type { TechPackPageData } from "@/lib/projects/tech-pack-data";
import { sectionHasForms, sectionLink, summaryTone } from "@/lib/projects/tech-pack-view";
import { ComponentsView, ConstructionView } from "./ComponentViews";
import { CoverView, FlatsView } from "./CoverAndFlats";
import { ComponentForms, LabellingForms, SeamForms } from "./DetailForms";
import { FabricForms } from "./FabricForms";
import { FormOpener } from "./FormOpener";
import { HowToMeasureView, MeasurementsView } from "./MeasurementViews";
import { ArtworkView, ColourwaysView, LabellingView, SignOffView, SuggestedView } from "./OtherViews";
import { TechPackDownloads } from "./TechPackDownloads";

/**
 * What is still to be confirmed, as a count at the top with a link to each section that has
 * something in it. Markup only: the count and every name come from the completeness report.
 */
function ConfirmSummary({ data }: Readonly<{ data: TechPackPageData }>) {
  const { report } = data;
  return (
    <Notice tone={summaryTone(report)}>
      <p className="font-medium" data-testid="confirm-count">
        {data.sentence}
      </p>
      <p className="mt-1" data-testid="unconfirmed-counts">
        <a href={sectionLink("suggested")} className="underline underline-offset-4">
          {`${report.suggested} ${report.suggested === 1 ? "suggestion" : "suggestions"} and ${report.proposed} ${report.proposed === 1 ? "proposal" : "proposals"} by Knitwright`}
        </a>
        , not confirmed by anyone.
      </p>
      {report.sections.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1" data-testid="confirm-list">
          {report.sections.map((section) => (
            <li key={section.id}>
              <a
                href={sectionLink(section.id)}
                className="underline underline-offset-4"
                {...(sectionHasForms(section.id) ? { "data-opens-forms": "true" } : {})}
              >
                {section.title}
              </a>
              : {section.items.length}
            </li>
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}

function Contents({ data }: Readonly<{ data: TechPackPageData }>) {
  return (
    <nav aria-label="Sections of the tech pack" className="rounded-2xl border border-hairline bg-surface p-4">
      <ol className="flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
        {data.pack.sections.map((section) => (
          <li key={section.id}>
            <a href={sectionLink(section.id)} className="text-cobalt underline-offset-4 hover:underline">
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

type DocumentProps = Readonly<{
  data: TechPackPageData;
  /** The colourway named in the address, so a download is the drawing the page shows. */
  colourwayId?: string | undefined;
}>;

/** The tech pack on screen: real headings, tables and lists, with the forms to fill in what is missing. */
export function TechPackDocument({ data, colourwayId }: DocumentProps) {
  const { pack, forms } = data;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">Tech pack</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{data.name}</h1>
          <p className="mt-2 text-sm text-muted">Version {data.version}</p>
        </div>
        <Link
          href={`/studio/${data.projectId}`}
          className="inline-flex h-11 items-center rounded-lg border border-hairline bg-surface px-5 text-[15px] font-semibold text-ink hover:bg-shell"
        >
          Back to the design
        </Link>
      </header>
      <FormOpener />
      {data.staleNote ? <Notice tone="warn">{data.staleNote}</Notice> : null}
      <ConfirmSummary data={data} />
      <Contents data={data} />
      <TechPackDownloads projectId={data.projectId} version={data.version} colourwayId={colourwayId} />
      <CoverView cover={pack.cover} />
      <FlatsView flats={pack.flats} pictures={data.flats} picturesNote={data.picturesNote} />
      <MeasurementsView table={pack.measurements} />
      <HowToMeasureView section={pack.howToMeasure} />
      <ComponentsView
        section={pack.components}
        forms={
          <div className="flex flex-col gap-6">
            <FabricForms fabrics={forms.fabrics} panels={forms.panels} />
            <h3 className="text-sm font-semibold text-ink">Describe rib, thread, labels and trims</h3>
            <ComponentForms rows={forms.components} />
          </div>
        }
      />
      <ConstructionView section={pack.construction} forms={<SeamForms rows={forms.seams} />} />
      <ColourwaysView section={pack.colourways} />
      <ArtworkView section={pack.artwork} />
      <LabellingView section={pack.labelling} forms={<LabellingForms rows={forms.labelling} />} />
      <SuggestedView section={pack.suggested} />
      <SignOffView section={pack.signOff} />
    </div>
  );
}

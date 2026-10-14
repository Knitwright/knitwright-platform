import type { ReactNode } from "react";
import type { FlatPicture } from "@/lib/projects/tech-pack-data";
import type { CoverSection, FlatsSection } from "@/lib/techpack";
import { Cellular, CellText, DocSection, DocTable, FillIn, RowHead } from "./parts";

type CoverProps = Readonly<{ cover: CoverSection; forms?: ReactNode; confirm?: ReactNode }>;

export function CoverView({ cover, forms, confirm }: CoverProps) {
  const facts: readonly (readonly [string, ReactNode])[] = [
    ["Style number", <CellText key="s" cell={cover.styleNumber} />],
    ["Season", <CellText key="e" cell={cover.season} />],
    ["Brand", <CellText key="b" cell={cover.brand} />],
    ["Design name", <CellText key="n" cell={cover.designName} />],
    ["Garment type", <CellText key="g" cell={cover.garmentType} />],
    ["Made for", <CellText key="w" cell={cover.wearer} />],
    ["Base size", <CellText key="z" cell={cover.baseSize} />],
    ["Size run", <CellText key="r" cell={cover.sizeRun} />],
  ];
  return (
    <DocSection id={cover.id} title={cover.title} note={cover.note}>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt className="text-sm text-muted">{term}</dt>
            <dd className="mt-0.5">{value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-sm text-muted">Version</dt>
          <dd className="mt-0.5 text-[15px] text-ink" data-testid="cover-version">
            {cover.version}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Date of this version</dt>
          <dd className="mt-0.5 text-[15px] text-ink">{cover.date}</dd>
        </div>
      </dl>
      <FillIn summary="Fill in the style number, season and sizes">{forms}</FillIn>
      <div>
        <h3 className="text-sm font-semibold text-ink">Design options</h3>
        <DocTable caption="Options chosen for this design" heads={["Option", "Choice"]}>
          {cover.options.map((option) => (
            <tr key={option.id}>
              <RowHead>{option.label}</RowHead>
              <Cellular>
                <CellText cell={option.choice} />
              </Cellular>
            </tr>
          ))}
        </DocTable>
      </div>
      {confirm}
      <div>
        <h3 className="text-sm font-semibold text-ink">Revision history</h3>
        {cover.revisions.length === 0 ? (
          <p className="mt-1 text-[15px] text-muted">No revisions have been recorded yet.</p>
        ) : (
          <DocTable caption="Revision history, newest first" heads={["Version", "Date", "What changed", "Made by"]}>
            {cover.revisions.map((revision) => (
              <tr key={revision.version}>
                <RowHead>{revision.version}</RowHead>
                <Cellular>{revision.date}</Cellular>
                <Cellular>{revision.note}</Cellular>
                <Cellular>{revision.by}</Cellular>
              </tr>
            ))}
          </DocTable>
        )}
        {cover.olderRevisionsNote ? <p className="mt-2 text-sm text-muted">{cover.olderRevisionsNote}</p> : null}
      </div>
    </DocSection>
  );
}

type FlatPicturesProps = Readonly<{ pictures: readonly FlatPicture[]; picturesNote: string | null }>;

/** The front and back drawings, with the note about pictures that are not shown. */
export function FlatPictures({ pictures, picturesNote }: FlatPicturesProps) {
  return (
    <>
      {picturesNote ? <p className="text-sm text-muted">{picturesNote}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {pictures.map((picture) => (
          <figure key={picture.view} className="m-0 rounded-xl border border-hairline bg-white p-2">
            {picture.src ? (
              // A data address cannot go through next/image, and this is a drawing, not a photo.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={picture.src}
                alt={picture.alt}
                data-testid={`techpack-flat-${picture.view}`}
                className="mx-auto h-auto max-h-[24rem] w-full object-contain"
              />
            ) : (
              <p className="p-6 text-center text-sm text-warn">{picture.notice}</p>
            )}
            <figcaption className="mt-1 text-center text-sm text-[#4b4f58]">{picture.label}</figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

/** The flats section. `pictures` is the drawings, which may arrive after the rest of the section. */
export function FlatsView({ flats, pictures }: Readonly<{ flats: FlatsSection; pictures: ReactNode }>) {
  return (
    <DocSection id={flats.id} title={flats.title} note={flats.note}>
      {pictures}
      {flats.callouts.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">Codes on the drawing</h3>
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {flats.callouts.map((callout) => (
              <li key={callout.code} className="text-[15px] text-ink-2">
                <span className="font-mono">{callout.code}</span> {callout.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DocSection>
  );
}

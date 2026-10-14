import type { ReactNode } from "react";
import type { ColourwayPicture } from "@/lib/projects/tech-pack-data";
import { sectionLink } from "@/lib/projects/tech-pack-view";
import { PROVENANCE_LABELS } from "@/lib/garment";
import { PROPOSAL_WORDS } from "@/lib/techpack/text";
import type {
  ArtworkSection,
  ColourwaysSection,
  LabellingSection,
  SignOffSection,
  SuggestedSection,
} from "@/lib/techpack";
import { Cellular, CellText, DocSection, DocTable, FillIn, LengthText, RowHead } from "./parts";

const SWATCH = /^#[0-9a-f]{6}$/;

export function ColourwayDrawing({ picture }: Readonly<{ picture: ColourwayPicture | undefined }>) {
  if (!picture) return null;
  return (
    <figure className="m-0 mb-3 max-w-sm rounded-xl border border-hairline bg-white p-2">
      {picture.src ? (
        // A data address cannot go through next/image, and this is a drawing, not a photo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture.src}
          alt={picture.alt}
          data-testid={`techpack-colourway-flat-${picture.colourwayId}`}
          className="mx-auto h-auto max-h-[18rem] w-full object-contain"
        />
      ) : (
        <p className="p-6 text-center text-sm text-warn">{picture.notice}</p>
      )}
      <figcaption className="mt-1 text-center text-sm text-[#4b4f58]">{picture.label}</figcaption>
    </figure>
  );
}

type ColourwaysProps = Readonly<{
  section: ColourwaysSection;
  /** The drawing of each colourway, by its id. A drawing may arrive after the rest of the section. */
  drawings?: Readonly<Record<string, ReactNode>>;
  forms?: ReactNode;
  confirm?: ReactNode;
}>;

export function ColourwaysView({ section, drawings = {}, forms, confirm }: ColourwaysProps) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <p className="text-sm text-muted">
        The colour code is what a factory uses. The screen colour only sets how the drawing looks.
      </p>
      {section.colourways.map((block) => (
        <div key={block.id}>
          <h3 className="text-sm font-semibold text-ink">{block.name}</h3>
          {drawings[block.id] ?? null}
          <DocTable caption={`Colours of ${block.name}`} heads={["Part", "Colour code", "Screen colour"]}>
            {block.rows.map((row) => (
              <tr key={row.panelId}>
                <RowHead>{row.label}</RowHead>
                <Cellular>
                  <CellText cell={row.code} />
                </Cellular>
                <Cellular>
                  <span className="inline-flex items-start gap-2">
                    {row.screenColour.status === "set" && SWATCH.test(row.screenColour.value) ? (
                      <span
                        aria-hidden="true"
                        className="mt-1 inline-block size-4 rounded border border-hairline"
                        style={{ backgroundColor: row.screenColour.value }}
                      />
                    ) : null}
                    <CellText cell={row.screenColour} />
                  </span>
                </Cellular>
              </tr>
            ))}
          </DocTable>
        </div>
      ))}
      {confirm}
      <FillIn summary="Fill in the colours">{forms}</FillIn>
    </DocSection>
  );
}

export function ArtworkView({ section, confirm }: Readonly<{ section: ArtworkSection; confirm?: ReactNode }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      {section.items.length > 0 ? (
        <DocTable
          caption="Artwork, where it sits and how it is made"
          heads={["Name", "Part", "Place", "Across", "Down", "Width", "Height", "Turn", "How it is made", "Shows"]}
        >
          {section.items.map((item) => (
            <tr key={item.id}>
              <RowHead>
                <CellText cell={item.name} />
              </RowHead>
              <Cellular>
                <CellText cell={item.panel} />
              </Cellular>
              <Cellular>
                <CellText cell={item.anchor} />
              </Cellular>
              <Cellular>
                <LengthText cell={item.across} />
              </Cellular>
              <Cellular>
                <LengthText cell={item.down} />
              </Cellular>
              <Cellular>
                <LengthText cell={item.width} />
              </Cellular>
              <Cellular>
                <LengthText cell={item.height} />
              </Cellular>
              <Cellular>
                <CellText cell={item.rotation} />
              </Cellular>
              <Cellular>
                <CellText cell={item.technique} />
              </Cellular>
              <Cellular>
                {item.content.kind === "text" ? (
                  <CellText cell={item.content.text} />
                ) : (
                  <CellText cell={item.content.description} />
                )}
              </Cellular>
            </tr>
          ))}
        </DocTable>
      ) : null}
      <PlayerMarksTable section={section} />
      {confirm}
    </DocSection>
  );
}

/** Player names and numbers, one row for each place (decision 0027). */
function PlayerMarksTable({ section }: Readonly<{ section: ArtworkSection }>) {
  if (section.playerMarks.length === 0) return null;
  return (
    <div className="mt-4" data-testid="player-marks">
      {section.playerMarksNote ? <p className="mb-2 text-sm text-muted">{section.playerMarksNote}</p> : null}
      <DocTable
        caption="Player names and numbers"
        heads={["Place", "Part", "Anchor", "Shows", "Height", "Lettering style", "Colour code", "Screen colour", "How it is made"]}
      >
        {section.playerMarks.map((item) => (
          <tr key={item.id}>
            <RowHead>
              <CellText cell={item.place} />
            </RowHead>
            <Cellular>
              <CellText cell={item.panel} />
            </Cellular>
            <Cellular>
              <CellText cell={item.anchor} />
            </Cellular>
            <Cellular>
              <CellText cell={item.shows} />
            </Cellular>
            <Cellular>
              <LengthText cell={item.height} />
            </Cellular>
            <Cellular>
              <CellText cell={item.style} />
            </Cellular>
            <Cellular>
              <CellText cell={item.colour} />
            </Cellular>
            <Cellular>
              <CellText cell={item.screenColour} />
            </Cellular>
            <Cellular>
              <CellText cell={item.technique} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
    </div>
  );
}

type LabellingProps = Readonly<{ section: LabellingSection; forms: ReactNode; confirm?: ReactNode }>;

export function LabellingView({ section, forms, confirm }: LabellingProps) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <DocTable caption="Labels and packing" heads={["Field", "Entry"]}>
        {section.rows.map((row) => (
          <tr key={row.field}>
            <RowHead>{row.label}</RowHead>
            <Cellular>
              <CellText cell={row.value} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
      {confirm}
      <FillIn summary="Fill in labels and packing">{forms}</FillIn>
    </DocSection>
  );
}

type SuggestedProps = Readonly<{ section: SuggestedSection }>;

export function SuggestedView({ section }: SuggestedProps) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      {section.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {section.items.map((item, index) => (
            <li key={`suggestion-${index}`} className="text-[15px] text-ink-2">
              <span className="rounded-md bg-warn-wash px-2 py-0.5 text-warn">{PROVENANCE_LABELS[item.provenance]}</span>{" "}
              {item.label}. Found in{" "}
              <a href={sectionLink(item.sectionId)} className="text-cobalt-soft underline-offset-4 hover:underline">
                {item.sectionTitle}
              </a>
              .
            </li>
          ))}
        </ul>
      ) : null}
      <h3 className="text-sm font-semibold text-ink">Proposed by Knitwright</h3>
      <p className="text-[15px] leading-relaxed text-muted">{section.proposalsNote}</p>
      {section.proposals.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {section.proposals.map((item, index) => (
            <li key={`proposal-${index}`} className="text-[15px] text-ink-2">
              <span className="rounded-md bg-warn-wash px-2 py-0.5 text-warn">{PROPOSAL_WORDS}</span> {item.label}. Found in{" "}
              <a href={sectionLink(item.sectionId)} className="text-cobalt-soft underline-offset-4 hover:underline">
                {item.sectionTitle}
              </a>
              .
            </li>
          ))}
        </ul>
      ) : null}
    </DocSection>
  );
}

export function SignOffView({ section }: Readonly<{ section: SignOffSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <p className="text-[15px] font-medium text-ink" data-testid="sign-off-statement">
        {section.statement}
      </p>
      <DocTable caption="Who signed, and when" heads={["Role", "Name", "Date"]}>
        {section.lines.map((line) => (
          <tr key={line.role}>
            <RowHead>{line.role}</RowHead>
            <Cellular>
              <CellText cell={line.name} />
            </Cellular>
            <Cellular>
              <CellText cell={line.date} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
      <h3 className="text-sm font-semibold text-ink">Strike-off</h3>
      <dl className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["Accepted by", section.strikeOff.acceptedBy],
            ["Date", section.strikeOff.date],
            ["Result", section.strikeOff.result],
          ] as const
        ).map(([label, cell]) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-0.5">
              <CellText cell={cell} />
            </dd>
          </div>
        ))}
      </dl>
    </DocSection>
  );
}

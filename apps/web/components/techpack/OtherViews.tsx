import type { ReactNode } from "react";
import { sectionLink } from "@/lib/projects/tech-pack-view";
import { PROVENANCE_LABELS } from "@/lib/garment";
import type {
  ArtworkSection,
  ColourwaysSection,
  LabellingSection,
  SignOffSection,
  SuggestedSection,
} from "@/lib/techpack";
import { Cellular, CellText, DocSection, DocTable, LengthText, RowHead } from "./parts";

const SWATCH = /^#[0-9a-f]{6}$/;

export function ColourwaysView({ section }: Readonly<{ section: ColourwaysSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <p className="text-sm text-muted">
        The colour code is what a factory uses. The screen colour only sets how the drawing looks.
      </p>
      {section.colourways.map((block) => (
        <div key={block.id}>
          <h3 className="text-sm font-semibold text-ink">{block.name}</h3>
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
    </DocSection>
  );
}

export function ArtworkView({ section }: Readonly<{ section: ArtworkSection }>) {
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
                  <span className="inline-flex flex-col">
                    <span className="text-xs text-muted">File</span>
                    <CellText cell={item.content.reference} />
                  </span>
                )}
              </Cellular>
            </tr>
          ))}
        </DocTable>
      ) : null}
    </DocSection>
  );
}

type LabellingProps = Readonly<{ section: LabellingSection; forms: ReactNode }>;

export function LabellingView({ section, forms }: LabellingProps) {
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
      <details className="rounded-xl border border-hairline p-4">
        <summary className="cursor-pointer text-[15px] font-medium text-ink">Fill in labels and packing</summary>
        <div className="mt-4">{forms}</div>
      </details>
    </DocSection>
  );
}

export function SuggestedView({ section }: Readonly<{ section: SuggestedSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      {section.items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {section.items.map((item) => (
            <li key={`${item.sectionId}-${item.label}-${item.provenance}`} className="text-[15px] text-ink-2">
              <span className="rounded-md bg-warn-wash px-2 py-0.5 text-warn">{PROVENANCE_LABELS[item.provenance]}</span>{" "}
              {item.label}. Found in{" "}
              <a href={sectionLink(item.sectionId)} className="text-cobalt underline-offset-4 hover:underline">
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
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Name</dt>
          <dd className="mt-0.5">
            <CellText cell={section.name} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Date</dt>
          <dd className="mt-0.5">
            <CellText cell={section.date} />
          </dd>
        </div>
      </dl>
    </DocSection>
  );
}

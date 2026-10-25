import type {
  ArtworkAndColourSection,
  FabricSection,
  OnPatternCell,
  OnPatternTable,
  OperationsSection,
  PatternAndCuttingSection,
  ReadinessSection,
} from "@/lib/techpack";
import { ImagesView, LayersView, PictureReadView } from "./ArtworkStackViews";
import { ColourStandards, PrintRulesView, RepeatView, ZonesView } from "./ArtworkColourParts";
import { Cellular, CellText, DocSection, DocTable, LengthText, RowHead } from "./parts";

/*
 * The sections added by tech pack v2: what is needed before the factory can start, the pattern and
 * cut list, the fabric, artwork and colour, and the order of work. They hold markup only.
 */

export function ReadinessView({ section }: Readonly<{ section: ReadinessSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <p className="text-[15px] font-medium text-ink" data-testid="readiness-summary" data-ready={section.ready}>
        {section.summary}
      </p>
      {section.open.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Who has something to do">
          {section.open.map((entry) => (
            <li key={entry.whoActs} className="rounded-md bg-warn-wash px-2 py-0.5 text-sm text-warn">
              {`${entry.actorLabel}: ${entry.count}`}
            </li>
          ))}
        </ul>
      ) : null}
      {section.groups.map((group) => (
        <div key={group.id}>
          <h3 className="text-sm font-semibold text-ink">{group.title}</h3>
          <ul className="mt-2 flex flex-col gap-1.5" data-testid={`readiness-${group.id}`}>
            {group.items.map((entry) => (
              <li key={entry.id} data-item={entry.id} data-met={entry.met} className="flex gap-2 text-[15px] text-ink-2">
                <span className={entry.met ? "text-muted" : "rounded-md bg-warn-wash px-2 py-0.5 text-warn"}>{entry.met ? "Done" : "Not yet"}</span>
                <span>
                  {entry.sentence}
                  {entry.met ? null : <span className="ml-1 text-xs text-muted">{`Who acts: ${entry.actorLabel}.`}</span>}
                  {entry.ownerInput ? (
                    <span className="mt-0.5 block text-xs text-muted" data-testid="owner-input">
                      {entry.ownerInput.sentence}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </DocSection>
  );
}

export function PatternAndCuttingView({ section }: Readonly<{ section: PatternAndCuttingSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <p className="text-[15px] text-ink-2" data-testid="pattern-review">
        <CellText cell={section.reviewStatus} />
      </p>
      {section.blockName ? <p className="text-sm text-muted">{`Pattern block: ${section.blockName}.`}</p> : null}
      {section.cutList.length > 0 ? (
        <>
          <DocTable caption="Pieces cut, for each size" heads={["Size", "Piece", "Cut", "Grain", "Outline", "Notches", "Area cut"]}>
            {section.cutList.map((row) => (
              <tr key={`${row.size}-${row.pieceId}`}>
                <RowHead>{row.size}</RowHead>
                <Cellular>
                  <CellText cell={row.name} />
                </Cellular>
                <Cellular>
                  <CellText cell={row.cut} />
                </Cellular>
                <Cellular>
                  <CellText cell={row.grain} />
                </Cellular>
                <Cellular>
                  <CellText cell={row.outline} />
                </Cellular>
                <Cellular>
                  <CellText cell={row.notches} />
                </Cellular>
                <Cellular>
                  <CellText cell={row.area} />
                </Cellular>
              </tr>
            ))}
          </DocTable>
          <h3 className="text-sm font-semibold text-ink">Seam allowance on each edge</h3>
          <DocTable caption="Seam allowance on each edge" heads={["Size", "Piece", "Seam", "Allowance", "Where it came from"]}>
            {section.seamAllowances.map((row) => (
              <tr key={`${row.size}-${row.pieceName}-${row.seamId}`}>
                <RowHead>{row.size}</RowHead>
                <Cellular>{row.pieceName}</Cellular>
                <Cellular>{row.seamId}</Cellular>
                <Cellular>
                  <LengthText cell={row.allowance} />
                </Cellular>
                <Cellular>{row.sourceNote}</Cellular>
              </tr>
            ))}
          </DocTable>
          <h3 className="text-sm font-semibold text-ink">Fabric use</h3>
          <p className="text-sm text-muted">{section.fabricUseNote}</p>
          <DocTable caption="Fabric use for each size" heads={["Size", "Area of all pieces", "Fabric needed"]}>
            {section.fabricUse.map((row) => (
              <tr key={row.size}>
                <RowHead>{row.size}</RowHead>
                <Cellular>
                  <CellText cell={row.area} />
                </Cellular>
                <Cellular>
                  <CellText cell={row.length} />
                </Cellular>
              </tr>
            ))}
          </DocTable>
        </>
      ) : null}
    </DocSection>
  );
}

export function FabricView({ section }: Readonly<{ section: FabricSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <DocTable caption="Stretch, shrink, weight and width of the fabric" heads={["Property", "Value", "Where it came from"]}>
        {section.rows.map((row) => (
          <tr key={row.id}>
            <RowHead>{row.label}</RowHead>
            <Cellular>
              <CellText cell={row.measure} />
            </Cellular>
            <Cellular>{row.sourceNote}</Cellular>
          </tr>
        ))}
        <tr>
          <RowHead>Print scale along the length</RowHead>
          <Cellular>
            <CellText cell={section.printScaleLength} />
          </Cellular>
          <Cellular>Worked out from the shrink</Cellular>
        </tr>
        <tr>
          <RowHead>Print scale across the width</RowHead>
          <Cellular>
            <CellText cell={section.printScaleWidth} />
          </Cellular>
          <Cellular>Worked out from the shrink</Cellular>
        </tr>
      </DocTable>
      <p className="text-sm text-muted">{section.printScaleNote}</p>
      <p className="text-sm text-muted">{section.reductionNote}</p>
    </DocSection>
  );
}

export function ArtworkAndColourView({ section }: Readonly<{ section: ArtworkAndColourSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <ColourStandards section={section} />
      <p className="text-sm text-muted">{section.colourNote}</p>
      <LayersView section={section} />
      <ImagesView section={section} />
      <PictureReadView section={section} />
      <RepeatView section={section} />
      <ZonesView section={section} />
      <PrintRulesView section={section} />
    </DocSection>
  );
}

export function OperationsView({ section }: Readonly<{ section: OperationsSection }>) {
  return (
    <DocSection id={section.id} title={section.title} note={section.note}>
      <p className="text-sm text-muted">
        {"Decoration method: "}
        <CellText cell={section.technique} />
      </p>
      <DocTable caption="The order of work" heads={["Step", "Stage", "What is done", "Source"]}>
        {section.steps.map((step) => (
          <tr key={step.order}>
            <RowHead>{step.order}</RowHead>
            <Cellular>{step.stageLabel}</Cellular>
            <Cellular>{step.label}</Cellular>
            <Cellular>
              <CellText cell={step.detail} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
    </DocSection>
  );
}

const STATUS_WORDS = {
  inside: "Inside",
  outside: "Outside the tolerance",
  "no-target": "No target",
  "no-tolerance": "No tolerance",
  "not-measured": "Not measured",
} as const;

function ResultText({ cell }: Readonly<{ cell: OnPatternCell }>) {
  return (
    <>
      <span className={cell.result === "outside" ? "rounded-md bg-warn-wash px-2 py-0.5 font-medium text-warn" : "text-ink-2"}>{STATUS_WORDS[cell.result]}</span>
      {cell.flag ? <span className="mt-1 block max-w-64 text-xs text-muted">{cell.flag}</span> : null}
    </>
  );
}

/** The measurement table set against the pattern, with every measurement outside its tolerance flagged. */
export function OnPatternView({ table }: Readonly<{ table: OnPatternTable }>) {
  return (
    <div data-testid="on-pattern" className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">Measured on the pattern</h3>
      <p className="text-sm text-muted" data-testid="on-pattern-summary">
        {table.summary}
      </p>
      <DocTable caption="Target, measured on the pattern, and the difference" heads={["Measurement", "Pattern size", "Target", "Measured", "Difference", "Result"]}>
        {table.rows.flatMap((row) =>
          row.cells.map((cell) => (
            <tr key={`${row.pointId}-${cell.size}`} data-status={cell.result}>
              <RowHead>{row.label}</RowHead>
              <Cellular>{cell.size}</Cellular>
              <Cellular>
                <LengthText cell={cell.target} />
              </Cellular>
              <Cellular>
                <LengthText cell={cell.measured} />
              </Cellular>
              <Cellular>
                <LengthText cell={cell.difference} />
              </Cellular>
              <Cellular>
                <ResultText cell={cell} />
              </Cellular>
            </tr>
          )),
        )}
      </DocTable>
      {table.patternOnly.length > 0 ? (
        <DocTable caption="Points only a pattern gives" heads={["Point", "Pattern size", "Target", "Measured", "Difference", "Result"]}>
          {table.patternOnly.flatMap((row) =>
            row.cells.map((cell) => (
              <tr key={`${row.pointId}-${cell.size}`} data-status={cell.result}>
                <RowHead>{row.label}</RowHead>
                <Cellular>{cell.size}</Cellular>
                <Cellular>
                  <LengthText cell={cell.target} />
                </Cellular>
                <Cellular>
                  <LengthText cell={cell.measured} />
                </Cellular>
                <Cellular>
                  <LengthText cell={cell.difference} />
                </Cellular>
                <Cellular>
                  <ResultText cell={cell} />
                </Cellular>
              </tr>
            )),
          )}
        </DocTable>
      ) : null}
    </div>
  );
}

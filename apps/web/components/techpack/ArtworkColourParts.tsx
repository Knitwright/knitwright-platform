import type { ArtworkAndColourSection } from "@/lib/techpack";
import { Cellular, CellText, DocTable, LengthText, RowHead } from "./parts";

const SWATCH = /^#[0-9a-f]{6}$/;

type ArtworkProps = Readonly<{ section: ArtworkAndColourSection }>;

export function ColourStandards({ section }: ArtworkProps) {
  return (
    <DocTable caption="Colour standards" heads={["Colour", "Role", "Name", "Factory code", "Screen colour (screen only)", "Other codes, as typed"]}>
        {section.colours.map((row) => (
          <tr key={row.id}>
            <RowHead>{row.id}</RowHead>
            <Cellular>{row.role}</Cellular>
            <Cellular>
              <CellText cell={row.name} />
            </Cellular>
            <Cellular>
              <CellText cell={row.factoryCode} />
            </Cellular>
            <Cellular>
              <span className="inline-flex items-start gap-2">
                {row.screenColour.status === "set" && SWATCH.test(row.screenColour.value) ? (
                  <span aria-hidden="true" className="mt-1 inline-block size-4 rounded border border-hairline" style={{ backgroundColor: row.screenColour.value }} />
                ) : null}
                <CellText cell={row.screenColour} />
              </span>
            </Cellular>
            <Cellular>{row.otherCodes}</Cellular>
          </tr>
        ))}
      </DocTable>
  );
}

export function RepeatView({ section }: ArtworkProps) {
  const repeat = section.repeat;
  if (!repeat) return null;
  return (
    <>
          <h3 className="text-sm font-semibold text-ink">Repeat</h3>
          <DocTable caption="The repeat" heads={["Item", "Value"]}>
            {repeat.lengths.map((row) => (
              <tr key={row.label}>
                <RowHead>{row.label}</RowHead>
                <Cellular>
                  <LengthText cell={row.measure} />
                </Cellular>
              </tr>
            ))}
            <tr>
              <RowHead>Closest gap between two dots, edge to edge</RowHead>
              <Cellular>
                <LengthText cell={repeat.gap} />
              </Cellular>
            </tr>
            {repeat.settings.map((row) => (
              <tr key={row.label}>
                <RowHead>{row.label}</RowHead>
                <Cellular>
                  <CellText cell={row.setting} />
                </Cellular>
              </tr>
            ))}
          </DocTable>
          <p className={`text-sm ${repeat.ok ? "text-muted" : "text-warn"}`} data-testid="repeat-checks">
            {repeat.checks.join(" ")}
          </p>
    </>
  );
}

export function ZonesView({ section }: ArtworkProps) {
  if (section.zones.length === 0) return null;
  return (
    <>
          <h3 className="text-sm font-semibold text-ink">Zones and clear space</h3>
          <DocTable caption="Zones and their clear space" heads={["Zone", "Piece", "Clear space", "Sizes"]}>
            {section.zones.map((row) => (
              <tr key={row.id}>
                <RowHead>{row.purpose}</RowHead>
                <Cellular>{row.pieceName}</Cellular>
                <Cellular>
                  <LengthText cell={row.clearSpace} />
                </Cellular>
                <Cellular>{row.sizes}</Cellular>
              </tr>
            ))}
          </DocTable>
          <h3 className="text-sm font-semibold text-ink">Placement on every size</h3>
          <DocTable caption="Placement of each zone on every size" heads={["Size", "Zone", "Down from high point of shoulder or cap", "Across from centre"]}>
            {section.placements.map((row) => (
              <tr key={`${row.zone}-${row.size}`}>
                <RowHead>{row.size}</RowHead>
                <Cellular>{row.zone}</Cellular>
                <Cellular>
                  <LengthText cell={row.down} />
                </Cellular>
                <Cellular>
                  <LengthText cell={row.across} />
                </Cellular>
              </tr>
            ))}
          </DocTable>
    </>
  );
}

export function PrintRulesView({ section }: ArtworkProps) {
  return (
    <>
      <h3 className="text-sm font-semibold text-ink">Print rules</h3>
      <DocTable caption="Print rules" heads={["Rule", "Value"]}>
        {section.printRules.map((row) => (
          <tr key={row.label}>
            <RowHead>{row.label}</RowHead>
            <Cellular>
              <CellText cell={row.text} />
            </Cellular>
          </tr>
        ))}
      </DocTable>
      <p className="text-sm text-muted">{section.printParametersNote}</p>
      {section.printParameters.length > 0 ? (
        <DocTable caption="Settings the print files were made with" heads={["Piece", "Size", "Bleed", "Scale across", "Scale down"]}>
          {section.printParameters.map((row) => (
            <tr key={`${row.pieceName}-${row.size}`}>
              <RowHead>{row.pieceName}</RowHead>
              <Cellular>{row.size}</Cellular>
              <Cellular>
                <LengthText cell={row.bleed} />
              </Cellular>
              <Cellular>
                <CellText cell={row.scaleAcross} />
              </Cellular>
              <Cellular>
                <CellText cell={row.scaleDown} />
              </Cellular>
            </tr>
          ))}
        </DocTable>
      ) : null}
    </>
  );
}

import type { ArtworkAndColourSection } from "@/lib/techpack";
import { CellText, Cellular, DocTable, LengthText, RowHead } from "./parts";

/*
 * What the artwork and colour page shows when a design has an artwork stack: the design in words, every layer, where
 * each placed layer sits on every size, the repeat spec, the resolution of each picture and, for a design read from a
 * picture, the report with its limits. They hold markup only.
 */

const RESULT_WORDS = { meets: "Meets the minimum", below: "Below the minimum", unknown: "Not known", vector: "Vector" } as const;

export function LayersView({ section }: Readonly<{ section: ArtworkAndColourSection }>) {
  if (section.source === "legacy") return null;
  return (
    <>
      {section.description ? (
        <p className="text-[15px] text-ink-2" data-testid="stack-description">
          {section.description}
        </p>
      ) : null}
      <h3 className="text-sm font-semibold text-ink">Layers, bottom to top</h3>
      <DocTable caption="Every layer of the artwork" heads={["Layer", "Kind", "Views", "Zone or anchor", "Clear space", "Method", "Where it came from", "Details"]}>
        {section.layers.map((row) => (
          <tr key={row.id} data-layer={row.id}>
            <RowHead>{row.name}</RowHead>
            <Cellular>{row.kind}</Cellular>
            <Cellular>{row.views}</Cellular>
            <Cellular>{row.where}</Cellular>
            <Cellular>{row.clearSpace === null ? "Not applicable" : <LengthText cell={row.clearSpace} />}</Cellular>
            <Cellular>{row.technique}</Cellular>
            <Cellular>{row.origin}</Cellular>
            <Cellular>{row.detail}</Cellular>
          </tr>
        ))}
      </DocTable>
      <h3 className="text-sm font-semibold text-ink">Placement of layers on every size</h3>
      <p className="text-sm text-muted">{section.layerPlacementNote}</p>
      {section.layerPlacements.length > 0 ? (
        <DocTable caption="Placement of each layer on every size" heads={["Layer", "Size", "View", "Down from high point of shoulder or cap", "Across from centre"]}>
          {section.layerPlacements.map((row) => (
            <tr key={`${row.layerId}-${row.view}-${row.size}`}>
              <RowHead>{row.layer}</RowHead>
              <Cellular>{row.size}</Cellular>
              <Cellular>{row.view}</Cellular>
              <Cellular>
                <LengthText cell={row.down} />
              </Cellular>
              <Cellular>
                <LengthText cell={row.across} />
              </Cellular>
            </tr>
          ))}
        </DocTable>
      ) : null}
      {section.repeatSpecs.length > 0 ? (
        <>
          <h3 className="text-sm font-semibold text-ink">Repeat spec</h3>
          <DocTable caption="The repeat of each pattern and repeating picture" heads={["Layer", "Name", "Repeat", "Seed", "Record a machine can read"]}>
            {section.repeatSpecs.map((row) => (
              <tr key={row.layerId} data-testid="repeat-spec">
                <RowHead>{row.layer}</RowHead>
                <Cellular>{row.name}</Cellular>
                <Cellular>{row.repeat}</Cellular>
                <Cellular>{row.seed}</Cellular>
                <Cellular>
                  <code className="break-all text-xs">{row.machine}</code>
                </Cellular>
              </tr>
            ))}
          </DocTable>
        </>
      ) : null}
    </>
  );
}

export function ImagesView({ section }: Readonly<{ section: ArtworkAndColourSection }>) {
  if (section.images.length === 0) return null;
  return (
    <>
      <h3 className="text-sm font-semibold text-ink">Pictures and their resolution</h3>
      <p className="text-sm text-muted">{section.imagesNote}</p>
      <DocTable caption="Resolution of each picture as printed" heads={["Layer", "Picture", "Pixels", "Printed width", "Resolution", "Result", "Accepted below the minimum by", "What it means"]}>
        {section.images.map((row) => (
          <tr key={row.layerId} data-image={row.layerId} data-result={row.result}>
            <RowHead>{row.layer}</RowHead>
            <Cellular>{row.picture}</Cellular>
            <Cellular>{row.pixels}</Cellular>
            <Cellular>
              <LengthText cell={row.printedWidth} />
            </Cellular>
            <Cellular>{row.dpi === null ? "Not applicable" : <CellText cell={row.dpi} />}</Cellular>
            <Cellular>{RESULT_WORDS[row.result]}</Cellular>
            <Cellular>
              <CellText cell={row.acceptedBy} />
            </Cellular>
            <Cellular>{row.sentence}</Cellular>
          </tr>
        ))}
      </DocTable>
    </>
  );
}

export function PictureReadView({ section }: Readonly<{ section: ArtworkAndColourSection }>) {
  const block = section.picture;
  if (block === null) return null;
  return (
    <>
      <h3 className="text-sm font-semibold text-ink">Read from a picture</h3>
      <p className="text-[15px] font-medium text-ink" data-testid="picture-read">
        {block.closeReading}
      </p>
      {block.summary ? <p className="text-sm text-ink-2">{block.summary}</p> : null}
      <p className="text-sm text-ink-2" data-testid="picture-acceptance">
        {"Accepted by: "}
        <CellText cell={block.acceptedBy} />
        {block.notAccepted.length > 0 ? ` The acceptance does not cover ${block.notAccepted.join(", ")}.` : ""}
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted" aria-label="What to keep in mind about a design read from a picture">
        {block.limits.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>
      {[...block.emptyViews, ...block.guessed, ...block.notes].length > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2" aria-label="What was left empty or guessed">
          {[...block.emptyViews, ...block.guessed.map((guess) => `Guessed: ${guess}.`), ...block.notes].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { SearchInput } from "@/components/ui/Inputs";
import type { EditorSlotProps } from "@/lib/editor";
import { FABRIC_CHIPS, filterFabrics, isApprovedRepeat, librarySection, type ClubLibrary } from "@/lib/garment-studio/library";
import { NO_GRAPHICS } from "@/lib/panel-layers/library-ports";
import { trimSummary } from "@/lib/workspace/summaries";
import type { ToolId } from "@/lib/workspace/tools";
import { Empty, Said, ShelfSection, Swatch, TargetPicker, Tile, useApply } from "./ShelfParts";

/**
 * The Knitwright library's five panels (plan v6 G1, decision 0150; `08` v3.6, s02, s04–s07). Every
 * list is the Library toolbar's own data (Y3): nothing here is a literal list of fabrics or colours.
 */

type ShelfProps = EditorSlotProps & Readonly<{ onTool: (tool: ToolId) => void }>;

/** s02: search, Fabra's chips and the base's approved fabrics. Collections are not on file yet and say so. */
export function FabricsShelf(slot: ShelfProps) {
  const applier = useApply(slot);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const section = librarySection(slot.design, "kw-fabrics");
  const shown = filterFabrics(section.items, query, chip);
  return (
    <>
      <SearchInput aria-label="Search fabrics" placeholder={'Try "mesh" or "recycled"'} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Fabric filters">
        {FABRIC_CHIPS.map((name) => (
          <FilterChip key={name} label={name} selected={chip === name} onClick={() => setChip(chip === name ? null : name)} />
        ))}
      </div>
      <TargetPicker applier={applier} busy={slot.design.busy} />
      <Said applier={applier} />
      <ShelfSection title="Recommended">
        {section.empty ? <Empty>{section.empty}</Empty> : null}
        {section.items.length > 0 && shown.length === 0 ? <Empty>No approved fabric matches. Clear the search to see them all.</Empty> : null}
        <ul className="grid grid-cols-2 gap-x-2.5 gap-y-4" data-testid="studio-fabrics">
          {shown.map((item) => (
            <Tile key={item.id} item={item} busy={slot.design.busy} onApply={applier.apply} />
          ))}
        </ul>
        <p className="text-caption text-muted">Only fabrics the factory stocks and has tested for this base. {section.note}</p>
      </ShelfSection>
      <ShelfSection title="Recommended collections">
        <Empty>Coming soon: groups of fabrics for match-day, training and warm-up kit.</Empty>
      </ShelfSection>
    </>
  );
}

/** s04: the club's palette, then the print-safe colours. */
export function ColoursShelf(slot: ShelfProps & Readonly<{ club: ClubLibrary }>) {
  const applier = useApply(slot);
  const section = librarySection(slot.design, "kw-colours");
  const clubColours = slot.club.palettes.flatMap((palette) => palette.colours);
  return (
    <>
      <TargetPicker applier={applier} busy={slot.design.busy} />
      <Said applier={applier} />
      <ShelfSection title={slot.club.name}>
        {clubColours.length === 0 ? (
          <Empty href="/brand" link="Add your colours">
            Your club has no colours on file yet.
          </Empty>
        ) : (
          <ul className="grid grid-cols-6 gap-2" data-testid="studio-club-colours">
            {clubColours.map((item) => (
              <Swatch key={item.id} item={item} busy={slot.design.busy} onApply={applier.apply} />
            ))}
          </ul>
        )}
      </ShelfSection>
      <ShelfSection title="Print-safe colours">
        <ul className="grid grid-cols-6 gap-2" data-testid="studio-print-safe">
          {section.items.map((item) => (
            <Swatch key={item.id} item={item} busy={slot.design.busy} onApply={applier.apply} />
          ))}
        </ul>
        <p className="text-caption text-muted">{section.note}</p>
      </ShelfSection>
    </>
  );
}

/** s05: the base's approved fills first, then every style the platform can draw. */
export function RepeatsShelf(slot: ShelfProps) {
  const applier = useApply(slot);
  const items = librarySection(slot.design, "kw-pattern-fills").items;
  const approved = items.filter(isApprovedRepeat);
  const styles = items.filter((item) => !isApprovedRepeat(item));
  return (
    <>
      <TargetPicker applier={applier} busy={slot.design.busy} />
      <Said applier={applier} />
      {approved.length > 0 ? (
        <ShelfSection title="Approved for this base">
          <ul className="grid grid-cols-2 gap-x-2.5 gap-y-4">
            {approved.map((item) => (
              <Tile key={item.id} item={item} busy={slot.design.busy} onApply={applier.apply} locked={item.card[0]?.value === "Not yet sampled"} />
            ))}
          </ul>
        </ShelfSection>
      ) : null}
      <ShelfSection title="Repeats">
        <ul className="grid grid-cols-2 gap-x-2.5 gap-y-4" data-testid="studio-repeats">
          {styles.map((item) => (
            <Tile key={item.id} item={item} busy={slot.design.busy} onApply={applier.apply} />
          ))}
        </ul>
      </ShelfSection>
    </>
  );
}

/** s06: the graphics on this design. Knitwright has no graphics library yet, and says so. */
export function GraphicsShelf({ design, onTool }: ShelfProps) {
  const graphics = design.spec.artwork;
  return (
    <>
      <ShelfSection title="On this design">
        {graphics.length === 0 ? (
          <Empty>No crest, sponsor or wording yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="studio-graphics">
            {graphics.map((graphic) => (
              <li key={graphic.id} className="flex flex-col rounded-md bg-soft px-3 py-2">
                <span className="text-small font-semibold text-text">{graphic.name}</span>
                <span className="text-caption text-muted">
                  {graphic.panelId} · {graphic.technique}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" icon={<Icon icon={Plus} size={20} />} onClick={() => onTool("logos")}>
          Add a crest, sponsor or wording
        </Button>
      </ShelfSection>
      <ShelfSection title="Knitwright graphics">
        <Empty>{NO_GRAPHICS}</Empty>
      </ShelfSection>
    </>
  );
}

/** s07: the trims and labels on this design, and the panels that change them. */
export function TrimsShelf({ design, onTool }: ShelfProps) {
  const trims = trimSummary(design.spec);
  return (
    <>
      <ShelfSection title="On this design">
        <ul className="flex flex-col gap-1" data-testid="studio-trims">
          {trims.map((fact) => (
            <li key={fact.label} className="flex flex-col rounded-md bg-soft px-3 py-2">
              <span className="text-small font-semibold text-text">{fact.label}</span>
              <span className="text-caption text-muted">{fact.value}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onTool("fabric")}>
            Edit trims
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onTool("labels")}>
            Edit labels
          </Button>
        </div>
      </ShelfSection>
      <Empty>The trims the factory stocks are listed here once the factory sends its trim list.</Empty>
    </>
  );
}

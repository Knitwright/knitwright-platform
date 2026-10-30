"use client";

import { useState } from "react";
import type { EditorSlotProps } from "@/lib/editor/slots";
import { applyItem, panelsOf, runSteps } from "@/lib/panel-layers/apply";
import { libraryGroups, type LibraryItem, type LibrarySection } from "@/lib/panel-layers/library";
import { CANVAS_HINT } from "@/lib/panel-layers/view-2d";
import { EditGraphicPanel } from "./EditGraphicPanel";
import { ItemRow } from "./ItemRow";
import { PatternFillPopover } from "./PatternFillPopover";

/**
 * The Library toolbar of spec F-S4 (plan v5 Y3, decision 0076): the Knitwright library, Your
 * library and Inspiration, with the pattern-fill popover and the Edit Graphic panel under them.
 *
 * It is a slot panel, so it reads only what the shell gave it and never fetches. Every list is
 * built from data the platform really holds — the base article's approved fabrics, the seeded
 * sportswear palettes, the styles the generators can draw — and a section whose data is not on the
 * slot contract says so in its own words rather than showing an invented list.
 */
export default function LibraryToolbar({ design, commands }: EditorSlotProps) {
  const groups = libraryGroups(design);
  const panels = panelsOf(design, { kind: "all" });
  const [said, setSaid] = useState<string | null>(null);
  const graphics = design.spec.artwork;
  const [chosen, setChosen] = useState<string | null>(null);
  const graphicId = chosen ?? graphics[0]?.id ?? null;

  const onAll = (item: LibraryItem) => setSaid(runSteps(applyItem(design, item, { kind: "all" }), commands));
  const onPanel = (item: LibraryItem, panelId: string) => setSaid(runSteps(applyItem(design, item, { kind: "panel", panelId }), commands));

  return (
    <div data-testid="library-toolbar" className="flex flex-col gap-4">
      <p className="text-[13px] text-chalk-muted">{CANVAS_HINT}.</p>
      {groups.map((group) => (
        <section key={group.id} aria-label={group.title} data-testid={`library-group-${group.id}`} className="flex flex-col gap-2">
          <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">{group.title}</h3>
          {group.sections.map((section) => (
            <Section key={section.id} section={section} panels={panels} busy={design.busy} onAll={onAll} onPanel={onPanel} />
          ))}
        </section>
      ))}
      <p role="status" className="text-[13px] text-ink empty:hidden">
        {said}
      </p>

      <section aria-label="Pattern fill settings" className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">Pattern fill</h3>
        <PatternFillPopover design={design} commands={commands} />
      </section>

      <section aria-label="Graphics on this design" className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">Graphics on this design</h3>
        {graphics.length === 0 ? (
          <p className="text-[13px] text-chalk-muted" data-testid="library-no-graphics">
            This design has no graphics on it yet. Add one from the Artwork panel of the Form toolbar.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {graphics.map((art) => (
                <li key={art.id}>
                  <button
                    type="button"
                    aria-pressed={art.id === graphicId}
                    onClick={() => setChosen(art.id)}
                    className={`chip-btn min-h-10 rounded-full border px-3 text-[13px] font-medium ${art.id === graphicId ? "border-cobalt text-ink" : "border-white/20 text-chalk-muted"}`}
                  >
                    {art.name}
                  </button>
                </li>
              ))}
            </ul>
            {graphicId === null ? null : <EditGraphicPanel design={design} commands={commands} artworkId={graphicId} />}
          </>
        )}
      </section>
    </div>
  );
}

type SectionProps = Readonly<{
  section: LibrarySection;
  panels: readonly string[];
  busy: boolean;
  onAll: (item: LibraryItem) => void;
  onPanel: (item: LibraryItem, panelId: string) => void;
}>;

function Section({ section, panels, busy, onAll, onPanel }: SectionProps) {
  return (
    <details data-testid={`library-section-${section.id}`} className="rounded-2xl border border-white/10 p-2">
      <summary className="min-h-10 cursor-pointer text-[13px] font-medium text-ink">
        {section.title} {section.items.length > 0 ? <span className="text-chalk-muted">({section.items.length})</span> : null}
      </summary>
      {section.note === null ? null : <p className="px-1 py-1 text-[11px] text-chalk-muted">{section.note}</p>}
      {section.empty === null ? null : (
        <p className="px-1 py-1 text-[12px] text-chalk-muted" data-testid={`library-empty-${section.id}`}>
          {section.empty}
        </p>
      )}
      {section.items.length === 0 ? null : (
        <ul className="mt-1 flex flex-col gap-2">
          {section.items.map((item) => (
            <ItemRow key={item.id} item={item} panels={panels} busy={busy} onAll={onAll} onPanel={onPanel} />
          ))}
        </ul>
      )}
    </details>
  );
}

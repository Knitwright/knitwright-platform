"use client";

import { InspirationPanel } from "@/components/inspiration/InspirationPanel";
import { AskBox } from "@/components/rulebook/ask/AskBox";
import type { EditorSlotProps, RailSegment } from "@/lib/editor";
import { SEGMENTS, segmentPanelId, segmentTabId } from "@/lib/editor";
import LibraryToolbar from "./library/LibraryToolbar";
import RepeatMaker from "./repeat-maker";
import SpecsToolbar from "./specs/SpecsToolbar";

/**
 * THE LIBRARY AND SPECS TOOLBARS, WITH THE PANELS OTHER WORKSTREAMS BUILT IN THEM.
 *
 * Both were labelled placeholders until now (code review v5, A7, A9, A13, A14): Y3's Library
 * toolbar, Y4's Specs toolbar, Y8's repeat maker, Z1's inspiration board and Z2's Ask box were all
 * built, tested and drawn nowhere. Every one of them is mounted here, in the shell's own directory,
 * so nothing is written into a directory another workstream owns (decision 0075 item 1).
 *
 * Each slot panel is given exactly `EditorSlotProps`. The three panels that are not slot panels sit
 * where the workstream that built them pointed:
 *
 * - **The repeat maker** under Pattern fills, where `lib/panel-layers/library.ts` already says in
 *   its own words that a style a design cannot store is published as a tile by the repeat maker.
 * - **The inspiration board** in the Inspiration group, the labelled slot Y3 left for it
 *   (decision 0082: "Y3 leaves a labelled Inspiration slot in the editor's Library panel").
 * - **The Ask box** under the Specs toolbar: decision 0083 left it for "the Studio's design
 *   surface", which is this shell, and scoped to the design it sits beside.
 */

type PanelProps = Readonly<{ segment: Exclude<RailSegment, "form">; hidden: boolean; slot: EditorSlotProps; boardShown: boolean }>;

/**
 * One of the two toolbars the shell does not build itself. Both are drawn and only the open one
 * shows, so every segment's `aria-controls` names a panel that really exists and a hidden panel
 * keeps what was typed in it.
 */
export function RailSlotPanel({ segment, hidden, slot, boardShown }: PanelProps) {
  return (
    <div
      id={segmentPanelId(segment)}
      role="tabpanel"
      aria-labelledby={segmentTabId(segment)}
      hidden={hidden}
      className="glass flex min-h-0 flex-col gap-3 overflow-y-auto rounded-3xl p-4"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{SEGMENTS[segment].title}</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{SEGMENTS[segment].lead}</p>
      </header>
      {segment === "library" ? <LibraryBody slot={slot} boardShown={boardShown} /> : <SpecsBody slot={slot} />}
    </div>
  );
}

/** Y3's toolbar, Y8's repeat maker and Z1's board, in the order the spec draws the Library toolbar. */
function LibraryBody({ slot, boardShown }: Readonly<{ slot: EditorSlotProps; boardShown: boolean }>) {
  return (
    <>
      <LibraryToolbar {...slot} />
      <RepeatMaker {...slot} />
      <section aria-label="Inspiration board" className="flex flex-col gap-2" data-testid="editor-inspiration">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-ink-2 uppercase">Inspiration board</h3>
        {/*
         * The board asks its server action for the whole board as soon as it is mounted, and all
         * three toolbars are drawn at once, so it is mounted the first time the Library toolbar is
         * opened rather than on every editor load. Once it is up it stays up, so switching toolbars
         * does not ask again.
         */}
        {boardShown ? (
          <InspirationPanel projectId={slot.design.projectId} />
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-2">Open the Library toolbar to read the board for this design.</p>
        )}
      </section>
    </>
  );
}

/** Y4's toolbar and Z2's Ask box, which answers out of the rulebook for this design's base article. */
function SpecsBody({ slot }: Readonly<{ slot: EditorSlotProps }>) {
  const code = slot.design.article?.code;
  return (
    <>
      <SpecsToolbar {...slot} />
      <div className="flex flex-col gap-2 border-t border-white/10 pt-3" data-testid="editor-ask">
        {/*
         * `method` is left out on purpose. The rulebook scopes a rule to a make method
         * ("sublimation"), and no method is on the slot contract: a design's artwork carries a
         * technique per piece of artwork, not one method for the garment. Sending one of them as
         * the design's method would be a guess, so the question is scoped to the article alone.
         */}
        <AskBox {...(code ? { articleCode: code } : {})} />
      </div>
    </>
  );
}

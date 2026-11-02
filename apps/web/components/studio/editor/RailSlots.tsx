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
 * Both segments drew a labelled placeholder until now (code review v5, A7, A9, A12, A13, A14):
 * Y3's Library toolbar, Y4's Specs toolbar, Y8's repeat maker, Z1's inspiration board and Z2's Ask
 * box were all built, tested and drawn nowhere. Every one of them is mounted here, in the shell's
 * own directory, so nothing is written into a directory another workstream owns (decision 0075
 * item 1).
 *
 * The three slot panels are given exactly `EditorSlotProps`, and each one sits where the
 * workstream that built it pointed:
 *
 * - **The repeat maker** (the `repeat-maker` slot) under Pattern fills, where
 *   `lib/panel-layers/library.ts` already says in its own words that a style a design cannot store
 *   is published as a tile by the repeat maker.
 * - **The inspiration board**, which is not a slot panel, in the Inspiration group: the labelled
 *   slot Y3 left for it (decision 0082, "Y3 leaves a labelled Inspiration slot in the editor's
 *   Library panel"). It takes the design's own id and nothing else.
 * - **The Ask box**, which is not a slot panel either, under the Specs toolbar: decision 0083 left
 *   it for "the Studio's design surface", which is this shell, and F-S5 asks for a box scoped to
 *   the design it sits beside.
 */

type PanelProps = Readonly<{ segment: Exclude<RailSegment, "form">; hidden: boolean; slot: EditorSlotProps; libraryOpened: boolean }>;

/**
 * One of the two toolbars the shell does not build itself. Both are drawn and only the open one
 * shows, so every segment's `aria-controls` names a panel that really exists and a hidden panel
 * keeps what was typed in it.
 *
 * `lg:row-start-1` puts all three toolbars in the rail column's one `minmax(0,1fr)` row, as the
 * launch shell's rail does (`components/launch/RailPanels.tsx`). Without it the second and third
 * panel land in an implicit `auto` row, so a toolbar as tall as these grows past the shell instead
 * of scrolling inside itself, and the overflow carried the panel over the toolbar tabs.
 */
export function RailSlotPanel({ segment, hidden, slot, libraryOpened }: PanelProps) {
  return (
    <div
      id={segmentPanelId(segment)}
      role="tabpanel"
      aria-labelledby={segmentTabId(segment)}
      hidden={hidden}
      className="glass flex min-h-0 flex-col gap-3 overflow-y-auto rounded-3xl p-4 lg:row-start-1"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{SEGMENTS[segment].title}</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{SEGMENTS[segment].lead}</p>
      </header>
      {segment === "library" ? <LibraryBody slot={slot} opened={libraryOpened} /> : <SpecsBody slot={slot} />}
    </div>
  );
}

/**
 * Y3's toolbar, Y8's repeat maker and Z1's board, in the order the spec draws the Library toolbar.
 *
 * The repeat maker and the board are drawn only once this toolbar has been opened, and then kept,
 * so a draft and a board already read survive a switch to another toolbar. All three toolbars are
 * in the page at once and neither of these two belongs there unasked: the board asks its server
 * action for the whole board as soon as it is mounted, which would be a round trip on every editor
 * page view, and the repeat maker carries the ordinary artwork upload, whose rights tick and file
 * field would be a second copy of the Logos tool's own on every editor page.
 */
function LibraryBody({ slot, opened }: Readonly<{ slot: EditorSlotProps; opened: boolean }>) {
  return (
    <>
      <LibraryToolbar {...slot} />
      {opened ? (
        <>
          <RepeatMaker {...slot} />
          <section aria-label="Inspiration board" className="flex flex-col gap-2" data-testid="editor-inspiration">
            <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-ink-2 uppercase">Inspiration board</h3>
            <InspirationPanel projectId={slot.design.projectId} />
          </section>
        </>
      ) : null}
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

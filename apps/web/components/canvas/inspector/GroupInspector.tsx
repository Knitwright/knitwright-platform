"use client";

import { AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, AlignCenterHorizontal, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { boxOf } from "@/lib/canvas";
import { ALIGNMENT_LABELS, ALIGNMENTS, aligned, boundsOfBoxes, type Alignment } from "@/lib/inspector/align";
import type { BoardView, LaunchCommands } from "@/lib/launch";
import { Row, Section } from "./parts";

/**
 * THE GROUP INSPECTOR (plan v6 E3, decision 0147; `08` §5.3, e24): two or more boards selected with
 * Shift-click or a marquee. Alignment moves them to the selection's own edges and centres through the
 * canvas's `moveBoard`, one board at a time, so every move is saved and undone as a drag is; the
 * transform is the selection's bounds.
 */

const ICONS: Readonly<Record<Alignment, LucideIcon>> = {
  left: AlignStartVertical,
  centre: AlignCenterVertical,
  right: AlignEndVertical,
  top: AlignStartHorizontal,
  middle: AlignCenterHorizontal,
  bottom: AlignEndHorizontal,
};

export function GroupInspector({ boards, busy, commands }: Readonly<{ boards: readonly BoardView[]; busy: boolean; commands: LaunchCommands }>) {
  const boxes = boards.map((board) => ({ id: board.id, box: boxOf(board) }));
  const bounds = boundsOfBoxes(boxes);
  const align = (how: Alignment): void => {
    for (const move of aligned(boxes, how)) commands.moveBoard(move.id, move.at);
  };
  return (
    <div className="flex flex-col" data-testid="group-inspector">
      <Section title="Alignment">
        <div role="toolbar" aria-label="Alignment" className="flex flex-wrap gap-1">
          {ALIGNMENTS.map((how) => (
            <button
              key={how}
              type="button"
              disabled={busy}
              onClick={() => align(how)}
              aria-label={ALIGNMENT_LABELS[how]}
              title={ALIGNMENT_LABELS[how]}
              data-testid={`align-${how}`}
              className="grid size-10 place-items-center rounded-md text-text-2 transition-colors duration-fast live:hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon icon={ICONS[how]} size={20} />
            </button>
          ))}
        </div>
      </Section>
      <Section title="Transform" aside={<span className="mr-auto text-small text-muted">px</span>}>
        <div className="grid grid-cols-2 gap-2">
          <Row label="W">{bounds?.width ?? 0}</Row>
          <Row label="H">{bounds?.height ?? 0}</Row>
        </div>
      </Section>
      <Section title="Selection">
        <p className="text-small text-muted">{boards.length} boards selected. Shift-click a board to add it or take it out.</p>
      </Section>
    </div>
  );
}

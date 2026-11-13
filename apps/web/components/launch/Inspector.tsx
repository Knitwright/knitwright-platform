"use client";

import type { ComponentType } from "react";
import InfoCardPanel from "@/components/flows/InfoCardPanel";
import { MARKETING_PANEL_COMPONENTS } from "@/components/marketing/panels";
import MockupBoardPanel from "@/components/mockups/MockupBoardPanel";
import AiImageBoardPanel from "@/components/shoots/AiImageBoardPanel";
import AiVideoPanel from "@/components/video/AiVideoPanel";
import { BoardActions } from "@/components/flows/BoardActions";
import type { FlowCostSource, OperationId } from "@/lib/flows";
import {
  BOARDS,
  PANEL_OF_KIND,
  type ArtboardPreset,
  type ArtboardUnit,
  type BoardKind,
  type BoardSelection,
  type Graph,
  type LaunchPanelId,
  type LaunchPanelProps,
  type ProjectColour,
  type Size,
} from "@/lib/launch";
import { ArtboardSize } from "./ArtboardSize";
import { PanelPlaceholder } from "./PanelPlaceholder";

/**
 * The board panels this file mounts itself: L2's mockup board (decision 0092), L3's AI image board
 * (0093), L5's AI video board (0095) and L6's info card (0096). L4's marketing board comes through
 * `MARKETING_PANEL_COMPONENTS`, that workstream's own registry (0094, item 16). Every board kind of
 * the contract now has a panel, so nothing in the inspector draws a placeholder any more.
 */
export const BOARD_PANELS: Partial<Record<LaunchPanelId, ComponentType<LaunchPanelProps>>> = {
  "board-mockup": MockupBoardPanel,
  "board-ai-image": AiImageBoardPanel,
  "board-ai-video": AiVideoPanel,
  "board-info-card": InfoCardPanel,
  ...MARKETING_PANEL_COMPONENTS,
};

/** What the `flow-run` panel of the contract needs beyond `LaunchPanelProps` (decision 0096). */
export type FlowRun = Readonly<{
  costs: FlowCostSource;
  /** Runs the whole canvas through L6's own action. The shell itself still makes no paid call. */
  onRunAll: (shownCredits: number) => void;
  /**
   * The canvas as L6 reads it. `BoardActions` needs it to say what each of its three operations
   * would do and what it would cost before it is pressed, which it works out from what the board is
   * connected to rather than from the board alone.
   */
  graph: Graph;
  /** Flatten, Upscale or Reframe on one board (spec F-L4), through L6's own action. */
  onOperation: (boardId: string, id: OperationId, options: Readonly<{ factor?: number; presetKey?: string }>) => void;
}>;

type Props = Readonly<{
  projectName: string;
  colours: readonly ProjectColour[];
  selection: BoardSelection;
  unit: ArtboardUnit;
  presets: readonly ArtboardPreset[];
  busy: boolean;
  /** Why the selected board cannot be run, or null. The lock is said here as well as on the board. */
  lockNote: string | null;
  onUnit: (unit: ArtboardUnit) => void;
  onSize: (size: Size) => void;
  onColours: (colours: readonly ProjectColour[]) => void;
  onAddBoard: (kind: BoardKind) => void;
  /** What a board's own panel is given, and all it is given (`lib/launch/panels.ts`). */
  panel: LaunchPanelProps;
  flow: FlowRun;
}>;

/**
 * The right inspector (spec Launch shell).
 *
 * With a board selected it shows the artboard size, the board's own panel (L2 to L6) and, where the
 * board needs a garment, whether one is behind it. With nothing selected E2's project panel
 * (`components/editor-chrome/ProjectPanel.tsx`) answers instead, and a garment, mockup or group
 * selection is E3's (`components/canvas/inspector/SelectionInspector.tsx`, decision 0147).
 */
export function Inspector(props: Props) {
  const { selection } = props;
  return (
    <aside aria-label="Inspector" data-testid="launch-inspector" className="glass flex min-h-0 flex-col gap-4 overflow-y-auto rounded-3xl p-4">
      <BoardPanel {...props} selection={selection} />
    </aside>
  );
}

type BoardPanelProps = Props & Readonly<{ selection: BoardSelection }>;

function BoardPanel({ selection, unit, presets, busy, lockNote, onUnit, onSize, panel, flow }: BoardPanelProps) {
  const panelId = PANEL_OF_KIND[selection.board.kind];
  const Built = panelId === null ? undefined : BOARD_PANELS[panelId];
  const info = BOARDS[selection.board.kind];
  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{selection.board.name || info.label}</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">{info.lead}</p>
      </header>
      {lockNote ? (
        <p role="status" data-testid="garment-lock-note" className="rounded-2xl border border-warn/30 bg-warn-wash px-3 py-2 text-[13px] leading-relaxed text-warn">
          {lockNote}
        </p>
      ) : null}
      <ArtboardSize board={selection.board} unit={unit} presets={presets} busy={busy} onUnit={onUnit} onSize={onSize} />
      {/* `shrink-0` for the same reason the run summary has it: the inspector is a scrolling flex
          column, several of these panels carry their own `min-h-0`, and without this the one at the
          bottom is squeezed to no height at all. It is here rather than in each panel so a panel
          landing later cannot be caught by it. */}
      {Built ? (
        <div className="shrink-0">
          <Built {...panel} />
        </div>
      ) : panelId ? (
        <PanelPlaceholder id={panelId} />
      ) : null}
      {/*
       * Flatten, Upscale and Reframe (spec F-L4). The contextual task bar already offers these three
       * and hands them to the board's own panel (`lib/launch/task-bar.ts`), and this is that panel:
       * until now the bar offered them and nothing drew them, which decision 0124 reported as a seam
       * with these exact lines. It goes last because it acts on the board the panel above describes.
       */}
      <div className="shrink-0">
        <BoardActions
          graph={flow.graph}
          board={selection.board}
          source={flow.costs}
          presets={presets}
          busy={busy}
          onOperation={(id, options) => flow.onOperation(selection.board.id, id, options)}
        />
      </div>
    </>
  );
}

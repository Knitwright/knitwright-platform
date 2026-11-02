"use client";

import { useId, useState, type ReactNode } from "react";
import MockupBoardPanel from "@/components/mockups/MockupBoardPanel";
import {
  BOARDS,
  PANEL_OF_KIND,
  type ArtboardPreset,
  type ArtboardUnit,
  type BoardKind,
  type BoardSelection,
  type LaunchPanelId,
  type LaunchPanelProps,
  type ProjectColour,
  type Size,
} from "@/lib/launch";
import { ArtboardSize } from "./ArtboardSize";
import { PanelPlaceholder } from "./PanelPlaceholder";

/** The board panels that are built, by their id. Everything else gets its placeholder. */
const BUILT: Partial<Record<LaunchPanelId, (props: LaunchPanelProps) => ReactNode>> = {
  "board-mockup": MockupBoardPanel,
};

type Props = Readonly<{
  projectName: string;
  colours: readonly ProjectColour[];
  selection: BoardSelection | null;
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
}>;

const CHIP = "chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-3.5 text-[13px] text-ink";

/** The tools the spec offers in the inspector with nothing selected. */
const TOOLS: readonly BoardKind[] = ["ai_image", "ai_video", "mockup"];

/**
 * The right inspector (spec Launch shell).
 *
 * With nothing selected it shows the project's name, its colours and the three tools. With a board
 * selected it shows the artboard size, the board's own panel (built by L2 to L6) and, where the
 * board needs a garment, whether one is behind it.
 */
export function Inspector(props: Props) {
  const { selection } = props;
  return (
    <aside aria-label="Inspector" data-testid="launch-inspector" className="glass flex min-h-0 flex-col gap-4 overflow-y-auto rounded-3xl p-4">
      {selection === null ? <ProjectPanel {...props} /> : <BoardPanel {...props} selection={selection} />}
    </aside>
  );
}

function ProjectPanel({ projectName, colours, busy, onColours, onAddBoard }: Props) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">{projectName}</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">Nothing is selected, so this is the whole project: its colours and the boards you can add.</p>
      </header>
      <ProjectColours colours={colours} busy={busy} onColours={onColours} />
      <section aria-label="Tools" className="flex flex-col gap-2">
        <h3 className="text-[13px] font-medium text-ink">Tools</h3>
        <ul className="flex flex-wrap gap-2">
          {TOOLS.map((kind) => (
            <li key={kind}>
              <button type="button" disabled={busy} onClick={() => onAddBoard(kind)} className={CHIP} data-testid={`add-${kind}`}>
                {BOARDS[kind].label} board
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[12px] leading-relaxed text-ink-2">
          Every one of them starts from a Design board, so the garment in the picture is the one the platform drew.
        </p>
      </section>
    </>
  );
}

type BoardPanelProps = Props & Readonly<{ selection: BoardSelection }>;

function BoardPanel({ selection, unit, presets, busy, lockNote, onUnit, onSize, panel }: BoardPanelProps) {
  const panelId = PANEL_OF_KIND[selection.board.kind];
  const Built = panelId === null ? undefined : BUILT[panelId];
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
      {Built ? <Built {...panel} /> : panelId ? <PanelPlaceholder id={panelId} /> : null}
    </>
  );
}

type ColourProps = Readonly<{ colours: readonly ProjectColour[]; busy: boolean; onColours: (colours: readonly ProjectColour[]) => void }>;

/**
 * Project colours (spec Launch shell, "Project colours"). The Brand panel of the rail is where a
 * brand palette comes from in one click (L7); these are the colours this project is using now.
 */
function ProjectColours({ colours, busy, onColours }: ColourProps) {
  const ids = { hex: useId(), name: useId() };
  const [hex, setHex] = useState("#0b1f4b");
  const [name, setName] = useState("");

  const add = () => {
    const given = name.trim();
    if (given === "") return;
    onColours([...colours, { hex, name: given }]);
    setName("");
  };

  return (
    <section aria-label="Project colours" className="flex flex-col gap-2" data-testid="project-colours">
      <h3 className="text-[13px] font-medium text-ink">Project colours</h3>
      {colours.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-ink-2">No colour on this project yet. Name one below, or take a palette from the Brand panel.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {colours.map((colour) => (
            <li key={`${colour.hex}-${colour.name}`} className="flex items-center gap-2 rounded-full border border-white/15 px-2 py-1">
              <span aria-hidden="true" className="size-4 rounded-full border border-white/20" style={{ backgroundColor: colour.hex }} />
              <span className="text-[13px] text-ink">{colour.name}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onColours(colours.filter((one) => one !== colour))}
                className="grid size-6 place-items-center rounded-full text-ink-2 hover:text-ink"
              >
                <span className="sr-only">Remove {colour.name}</span>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.hex} className="text-[12px] text-ink-2">
            Colour
          </label>
          <input id={ids.hex} type="color" value={hex} disabled={busy} onChange={(event) => setHex(event.target.value)} className="h-10 w-12 rounded-xl border border-white/15 bg-surface" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={ids.name} className="text-[12px] text-ink-2">
            Name it
          </label>
          <input
            id={ids.name}
            maxLength={60}
            value={name}
            disabled={busy}
            placeholder="Club navy"
            onChange={(event) => setName(event.target.value)}
            className="min-h-10 w-full rounded-xl border border-white/15 bg-surface px-2 text-[13px] text-ink"
          />
        </div>
        <button type="button" disabled={busy || name.trim() === ""} onClick={add} className={CHIP} data-testid="add-colour">
          Add
        </button>
      </div>
    </section>
  );
}

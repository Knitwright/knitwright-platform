"use client";

import { Clapperboard, FileText, ImagePlus, Info, LayoutTemplate, Plus, Shirt, Grip, Table, X, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { BOARDS, type BoardKind, type ProjectColour } from "@/lib/launch";

type Props = Readonly<{
  colours: readonly ProjectColour[];
  busy: boolean;
  onColours: (colours: readonly ProjectColour[]) => void;
  onAddBoard: (kind: BoardKind) => void;
  /** Browse Color Palettes: the Brand panel, where a palette comes from in one click (L7). */
  onBrowsePalettes: () => void;
  /** The run summary of the whole canvas (L6's `flow-run` panel), drawn under the tools. */
  runSummary: ReactNode;
}>;

/** The tools of `08` §5.3 "Nothing" first, then the two launch boards the launch inspector offered, so none is lost. */
const TOOLS: readonly Readonly<{ kind: BoardKind; label: string; icon: LucideIcon }>[] = [
  { kind: "ai_image", label: "AI Image Board", icon: ImagePlus },
  { kind: "ai_video", label: "AI Video Board", icon: Clapperboard },
  { kind: "mockup", label: "Mockup", icon: Shirt },
  { kind: "tech_pack", label: "Tech Pack", icon: FileText },
  { kind: "marketing", label: "Marketing board", icon: LayoutTemplate },
  { kind: "info_card", label: "Info card", icon: Table },
];

const SHOWN_COLOURS = 4;

/**
 * THE RIGHT PANEL WITH NOTHING SELECTED (`08` §5.3 "Nothing"; prototype e01; decision 0146):
 * **Project Colors** as hex and opacity rows with "See all n colors" and Browse Color Palettes, and
 * **Tools**, each a card that adds that board to the canvas. Under them, the run summary.
 */
export function ProjectPanel({ colours, busy, onColours, onAddBoard, onBrowsePalettes, runSummary }: Props) {
  return (
    <aside aria-label="Inspector" data-testid="launch-inspector" className="flex flex-col">
      <ProjectColours colours={colours} busy={busy} onColours={onColours} onBrowse={onBrowsePalettes} />
      <section aria-label="Tools" className="flex flex-col gap-2.5 border-b border-border px-4 py-4.5">
        <h3 className="text-body-lg font-semibold text-text">Tools</h3>
        {TOOLS.map((tool) => (
          <button
            key={tool.kind}
            type="button"
            disabled={busy}
            onClick={() => onAddBoard(tool.kind)}
            title={BOARDS[tool.kind].lead}
            className="flex h-11.5 w-full items-center gap-2.5 rounded-md border border-border bg-bg px-3 text-left text-body-lg font-semibold text-text hover:bg-soft disabled:cursor-not-allowed disabled:text-muted-2 disabled:hover:bg-bg"
            data-testid={`add-${tool.kind}`}
          >
            <Icon icon={tool.icon} />
            {tool.label}
            <Icon icon={Info} size={16} className="ml-auto text-muted-2" />
          </button>
        ))}
      </section>
      {runSummary ? <div className="shrink-0 px-4 py-4.5">{runSummary}</div> : null}
    </aside>
  );
}

type ColourProps = Readonly<{ colours: readonly ProjectColour[]; busy: boolean; onColours: (colours: readonly ProjectColour[]) => void; onBrowse: () => void }>;

const hexWord = (hex: string): string => hex.replace(/^#/, "").toUpperCase();

function ProjectColours({ colours, busy, onColours, onBrowse }: ColourProps) {
  const ids = { hex: useId(), name: useId() };
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hex, setHex] = useState("#0b1f4b");
  const [name, setName] = useState("");
  const shown = all ? colours : colours.slice(0, SHOWN_COLOURS);

  const add = () => {
    const given = name.trim();
    if (given === "") return;
    onColours([...colours, { hex, name: given }]);
    setName("");
  };

  return (
    <section aria-label="Project colours" className="flex flex-col gap-1 border-b border-border px-4 py-4.5" data-testid="project-colours">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-body-lg font-semibold text-text">Project Colors</h3>
        <button
          type="button"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
          aria-label="Add a colour"
          className="grid size-7 place-items-center rounded-sm text-text-2 hover:bg-soft"
          data-testid="project-colours-add"
        >
          <Icon icon={Plus} size={16} />
        </button>
      </div>
      {colours.length === 0 ? <p className="text-small text-muted">No colour on this project yet. Add one, or take a palette from your brand.</p> : null}
      <ul className="flex flex-col">
        {shown.map((colour) => (
          <li key={`${colour.hex}-${colour.name}`} className="group flex h-10 items-center gap-3 text-body-lg text-text">
            <span aria-hidden="true" className="size-6 shrink-0 rounded-xs border border-border" style={{ backgroundColor: colour.hex }} />
            <span className="w-19 font-medium">{hexWord(colour.hex)}</span>
            <span>100%</span>
            <span className="min-w-0 flex-1 truncate text-small text-muted">{colour.name}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onColours(colours.filter((one) => one !== colour))}
              className="grid size-7 place-items-center rounded-sm text-muted opacity-0 group-hover:opacity-100 hover:bg-soft focus-visible:opacity-100"
            >
              <span className="sr-only">Remove {colour.name}</span>
              <Icon icon={X} size={16} />
            </button>
          </li>
        ))}
      </ul>
      {colours.length > SHOWN_COLOURS ? (
        <button type="button" onClick={() => setAll(!all)} className="flex h-10 items-center gap-3 text-body-lg text-muted hover:text-text">
          <Icon icon={Grip} />
          {all ? "Show fewer colors" : `See all ${colours.length} colors`}
        </button>
      ) : null}
      {adding || colours.length === 0 ? (
        <div className="mt-1 flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.hex} className="text-caption text-muted">
              Colour
            </label>
            <input id={ids.hex} type="color" value={hex} disabled={busy} onChange={(event) => setHex(event.target.value)} className="h-10 w-12 rounded-md border border-border bg-bg" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={ids.name} className="text-caption text-muted">
              Name it
            </label>
            <input
              id={ids.name}
              maxLength={60}
              value={name}
              disabled={busy}
              placeholder="Club navy"
              onChange={(event) => setName(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-bg px-2 text-body text-text"
            />
          </div>
          <button
            type="button"
            disabled={busy || name.trim() === ""}
            onClick={add}
            className="h-10 rounded-md border border-border px-3 text-body font-semibold text-text hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="add-colour"
          >
            Add
          </button>
        </div>
      ) : null}
      <button type="button" onClick={onBrowse} className={cx("mt-2.5 h-11.5 w-full rounded-md border border-border bg-bg text-body-lg font-semibold text-text hover:bg-soft")} data-testid="browse-palettes">
        Browse Color Palettes
      </button>
    </section>
  );
}

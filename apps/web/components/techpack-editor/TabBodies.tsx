"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LockMark } from "@/components/ui/Marks";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { editorTabOf, type EditorTab, type EditorTabId } from "@/lib/techpack/editor/tabs";
import type { StageCallout } from "@/lib/techpack/editor/stage";
import type { ReviewView } from "@/lib/techpack/view/review";
import { FieldTable, PartHeading, PartView, RowsTable } from "./Parts";
import type { StageSelection } from "./StageMarks";

/**
 * The tab bodies with a shape of their own (spec screen 30): Overview's numbered Field | Value
 * table with the Review part under it, and Callouts' numbered list with "Add callout on the 3D view".
 * Every other tab, and every folded part, is drawn by `PartView`.
 */

export function OverviewBody({ tab, review, onGo }: Readonly<{ tab: EditorTab; review: ReviewView; onGo: (tab: EditorTabId) => void }>) {
  const [own, ...folded] = tab.parts;
  if (!own) return null;
  const fields = own.sections.flatMap((section) => section.fields);
  const tables = own.sections.flatMap((section) => section.tables);
  const notes = own.sections.flatMap((section) => (section.note ? [section.note] : []));
  return (
    <div className="flex flex-col gap-4">
      {notes.map((note) => (
        <p key={note} className="px-3 text-small text-muted">
          {note}
        </p>
      ))}
      <FieldTable fields={fields} from={own.from} caption="Overview" numbered />
      {tables.map((table) => (
        <RowsTable key={table.id} table={table} from={own.from} />
      ))}
      {folded.map((part) => (part.from === "review" ? <ReviewPart key={part.from} part={part} review={review} onGo={onGo} /> : <PartView key={part.from} part={part} />))}
    </div>
  );
}

function ReviewPart({ part, review, onGo }: Readonly<{ part: EditorTab["parts"][number]; review: ReviewView; onGo: (tab: EditorTabId) => void }>) {
  return (
    <div className="flex flex-col gap-3" data-testid="tp-review">
      <PartHeading part={part} />
      <p className={`px-3 text-small font-semibold ${review.exportBlocked ? "text-warn" : "text-ok"}`}>{review.summary}</p>
      <ul className="flex flex-col gap-1 px-3">
        {review.checks.map((check) => (
          <li key={check.id} className="text-small text-text-2">
            <span className="font-semibold text-text">{check.label}.</span> {check.detail}
          </li>
        ))}
      </ul>
      {review.items.length > 0 ? (
        <Table caption="Fields still to fill">
          <thead>
            <tr>
              <Th>Tab</Th>
              <Th>Field</Th>
              <Th>
                <span className="sr-only">Go</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {review.items.map((item) => (
              <Tr key={`${item.tabId}-${item.cellId}`}>
                <Td>{item.tabLabel}</Td>
                <Td>{item.label}</Td>
                <Td className="text-right">
                  <Button variant="link" size="xs" onClick={() => onGo(editorTabOf(item.tabId))} aria-label={`Go to ${item.label}`}>
                    Go to
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </div>
  );
}

type CalloutsProps = Readonly<{
  tab: EditorTab;
  callouts: readonly StageCallout[];
  selection: StageSelection;
  onSelect: (selection: StageSelection) => void;
  /** Null where nothing can be saved (a preview); then the add and delete buttons are not offered. */
  onAdd: (() => void) | null;
  onRemove: ((markId: string) => void) | null;
  busy: boolean;
}>;

export function CalloutsBody({ tab, callouts, selection, onSelect, onAdd, onRemove, busy }: CalloutsProps) {
  const [, ...rest] = tab.parts;
  const own = tab.parts[0];
  return (
    <div className="flex flex-col gap-4">
      <Table caption="Callouts">
        <thead>
          <tr>
            <Th className="w-12">
              <span className="sr-only">Number</span>
            </Th>
            <Th>Callout</Th>
            <Th className="w-14">
              <span className="sr-only">Delete</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {callouts.map((callout) => (
            <CalloutRow key={callout.number} callout={callout} selected={selection?.kind === "callout" && selection.number === callout.number} onSelect={onSelect} onRemove={onRemove} busy={busy} />
          ))}
        </tbody>
      </Table>
      {callouts.length === 0 ? <p className="px-3 text-small text-muted">No construction table is on file for this base article yet, so it has no callouts.</p> : null}
      {onAdd ? (
        <Button variant="secondary" size="sm" icon={<Icon icon={Plus} size={16} />} onClick={onAdd} disabled={busy} className="self-start" data-testid="tp-add-callout">
          Add callout on the 3D view
        </Button>
      ) : null}
      {own ? own.sections.filter((section) => section.id !== "callouts").map((section) => <PartView key={section.id} part={{ ...own, sections: [section] }} />) : null}
      {rest.map((part) => (
        <PartView key={part.from} part={part} />
      ))}
    </div>
  );
}

type RowProps = Readonly<{ callout: StageCallout; selected: boolean; onSelect: (selection: StageSelection) => void; onRemove: ((markId: string) => void) | null; busy: boolean }>;

function CalloutRow({ callout, selected, onSelect, onRemove, busy }: RowProps) {
  return (
    <Tr className={selected ? "bg-electric-soft" : undefined}>
      <Td>
        <button
          type="button"
          onClick={() => onSelect({ kind: "callout", number: callout.number })}
          aria-label={`Show callout ${callout.number} on the garment`}
          aria-pressed={selected}
          className="grid size-6 place-items-center rounded-full bg-mark-callout text-caption font-bold text-on-dark"
        >
          {callout.number}
        </button>
      </Td>
      <Td>{callout.text}</Td>
      <Td className="text-right">
        {callout.markId && onRemove ? (
          <Button variant="ghost" size="xs" iconOnly aria-label={`Delete callout ${callout.number}`} icon={<Icon icon={Trash2} size={16} />} disabled={busy} onClick={() => callout.markId && onRemove(callout.markId)} />
        ) : callout.markId ? null : (
          <LockMark label="The base article fixes its construction." className="ml-auto" />
        )}
      </Td>
    </Tr>
  );
}

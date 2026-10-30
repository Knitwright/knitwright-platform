"use client";

import { useId } from "react";
import { DRAG_TYPE, dragPayload } from "@/lib/panel-layers/drag";
import type { LibraryItem } from "@/lib/panel-layers/library";
import { WhyButton } from "../WhyButton";

/**
 * One row of the Library toolbar (plan v5 Y3, decision 0076). Spec F-S4 applies a library item two
 * ways: "click to apply to all pieces, or drag onto a single panel". A drag is not
 * keyboard-reachable (decision 0064), so the row carries both: the main button applies to every
 * panel, and the picker beside it puts the item on the one panel a person chooses. The drag is the
 * same thing with a mouse.
 */

export type ItemRowProps = Readonly<{
  item: LibraryItem;
  panels: readonly string[];
  busy: boolean;
  onAll: (item: LibraryItem) => void;
  onPanel: (item: LibraryItem, panelId: string) => void;
}>;

export function ItemRow({ item, panels, busy, onAll, onPanel }: ItemRowProps) {
  const pickerId = useId();
  const cannot = item.apply.kind === "none" ? item.apply.reason : null;
  return (
    <li
      data-testid={`library-item-${item.id}`}
      draggable={!busy && cannot === null}
      onDragStart={(event) => event.dataTransfer.setData(DRAG_TYPE, dragPayload(item))}
      className="flex flex-col gap-1 rounded-xl border border-white/10 p-2"
    >
      <div className="flex items-center gap-2">
        {item.swatch === null ? null : <span aria-hidden="true" className="size-5 shrink-0 rounded-full border border-white/25" style={{ background: item.swatch }} />}
        <button
          type="button"
          disabled={busy || cannot !== null}
          onClick={() => onAll(item)}
          className="chip-btn min-h-10 flex-1 rounded-full border border-white/20 px-3 text-left text-[13px] font-medium text-ink disabled:opacity-50"
        >
          {item.code === null ? null : <span className="font-mono text-[11px] text-chalk-muted">{item.code} </span>}
          {item.label}
        </button>
        <WhyButton ruleId={item.ruleId} context={`library ${item.kind} ${item.id}`} />
      </div>
      {item.card.length === 0 ? null : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-[11px] text-chalk-muted">
          {item.card.map((row) => (
            <div key={row.label} className="col-span-2 grid grid-cols-subgrid">
              <dt>{row.label}</dt>
              <dd className="text-ink-2">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {cannot === null ? (
        <div className="flex items-center gap-2">
          <label htmlFor={pickerId} className="text-[11px] text-chalk-muted">
            Or one panel
          </label>
          <select
            id={pickerId}
            defaultValue=""
            disabled={busy || panels.length === 0}
            onChange={(event) => {
              if (event.target.value !== "") onPanel(item, event.target.value);
              event.target.value = "";
            }}
            className="min-h-10 flex-1 rounded-full border border-white/20 bg-transparent px-3 text-[12px] text-ink"
          >
            <option value="">Choose a panel</option>
            {panels.map((panelId) => (
              <option key={panelId} value={panelId}>
                {panelId}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-[11px] text-warn">{cannot}</p>
      )}
    </li>
  );
}

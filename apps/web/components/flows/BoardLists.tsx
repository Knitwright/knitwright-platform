"use client";

import type { CSSProperties } from "react";
import type { AddItem, ConnectTarget } from "@/lib/flows";

/**
 * The two lists a board's connector dot opens (spec F-L4): Add… a board after this one, and Connect
 * from here into another board. Both are always rendered and hidden when closed, so each button's
 * `aria-controls` always names a list that really exists.
 *
 * They live on their own so the one canvas (decision 0145) can draw them over the plane, in screen
 * space, where a list never falls off the edge of a canvas that clips what it holds; L6's card draws
 * them under itself, as it always did, when nothing else does.
 */

const PANEL = "glass z-30 flex flex-col gap-0.5 rounded-2xl p-2 shadow-lg";

type Placed = Readonly<{ className?: string; style?: CSSProperties }>;

export function AddList({ boardId, name, open, items, onAdd, className = "", style }: Placed & Readonly<{
  boardId: string;
  name: string;
  open: boolean;
  items: readonly AddItem[];
  onAdd: (item: AddItem) => void;
}>) {
  return (
    <ul id={`flow-add-${boardId}`} hidden={!open} aria-label={`Add a board after ${name}`} className={`${PANEL} w-60 ${className}`} style={style}>
      {items.map((item) => (
        <li key={item.kind}>
          <button
            type="button"
            onClick={() => onAdd(item)}
            className="flex min-h-10 w-full flex-col items-start rounded-xl px-3 py-1.5 text-left hover:bg-tile-2"
            data-testid={`flow-add-${item.kind}-${boardId}`}
          >
            <span className="flex w-full items-center justify-between gap-2 text-[13px] text-ink">
              {item.label}
              <span className="font-mono text-[10px] text-ink-2">{item.paid ? "credits" : "free"}</span>
            </span>
            <span className="text-[11px] leading-snug text-ink-2">{item.lead}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ConnectList({ boardId, name, open, targets, onConnect, className = "", style }: Placed & Readonly<{
  boardId: string;
  name: string;
  open: boolean;
  targets: readonly ConnectTarget[];
  onConnect: (target: ConnectTarget) => void;
}>) {
  return (
    <ul
      id={`flow-connect-${boardId}`}
      hidden={!open}
      aria-label={`Connect ${name} into another board`}
      className={`${PANEL} max-h-72 w-72 overflow-y-auto ${className}`}
      style={style}
    >
      {targets.map((target) => (
        <li key={target.boardId}>
          <button
            type="button"
            disabled={target.blocked !== null}
            aria-describedby={target.blocked === null ? undefined : `flow-blocked-${boardId}-${target.boardId}`}
            onClick={() => onConnect(target)}
            className="flex min-h-10 w-full flex-col items-start rounded-xl px-3 py-1.5 text-left hover:bg-tile-2 disabled:opacity-70"
            data-testid={`flow-connect-${target.boardId}`}
          >
            <span className="text-[13px] text-ink">
              {target.name}
              {target.inputIndex === null ? "" : ` · input ${target.inputIndex}`}
            </span>
            {target.blocked === null ? null : (
              <span id={`flow-blocked-${boardId}-${target.boardId}`} className="text-[11px] leading-snug text-ink-2">
                {target.blocked}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

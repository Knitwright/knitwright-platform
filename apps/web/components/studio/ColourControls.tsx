"use client";

import { useEffect, useId, useState } from "react";
import type { ColourChange, ColourRow } from "@/lib/projects/colour-controls";
import { colourKey } from "./keys";

type ColourControlsProps = Readonly<{
  rows: readonly ColourRow[];
  errorFor: (key: string) => string | null;
  onPickSwatch: (panelId: string, swatch: string) => void;
  onSettleSwatch: (panelId: string) => void;
  onChangeText: (panelId: string, change: ColourChange, asked: boolean) => void;
  onTyping: (key: string) => void;
  onDirty: (key: string, dirty: boolean) => void;
}>;

/** A colour for each part of the design. This holds markup and wiring only. */
export function ColourControls({ rows, errorFor, ...handlers }: ColourControlsProps) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((row) => (
        <li key={row.panelId} className="rounded-xl border border-hairline p-4">
          <ColourRowControl row={row} error={errorFor(colourKey(row.panelId))} {...handlers} />
        </li>
      ))}
    </ul>
  );
}

type RowProps = Readonly<{ row: ColourRow; error: string | null }> & Omit<ColourControlsProps, "rows" | "errorFor">;

function ColourRowControl({ row, error, onPickSwatch, onSettleSwatch, onChangeText, onTyping, onDirty }: RowProps) {
  const id = useId();
  const key = colourKey(row.panelId);
  const [text, setText] = useState(row.colourText);
  const [server, setServer] = useState(row.colourText);
  if (server !== row.colourText) {
    setServer(row.colourText);
    setText(row.colourText);
  }
  const dirty = text.trim() !== server;
  useEffect(() => onDirty(key, dirty), [key, dirty, onDirty]);
  useEffect(() => () => onDirty(key, false), [key, onDirty]);

  const commit = (asked: boolean) => {
    if (text.trim() !== server) onChangeText(row.panelId, { colourText: text }, asked);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-ink">{row.label}</p>
      <div className="flex items-center gap-3">
        <SwatchInput row={row} id={`${id}-swatch`} onPick={onPickSwatch} onSettle={onSettleSwatch} />
        <CodeInput
          id={`${id}-code`}
          fieldKey={key}
          label={row.label}
          text={text}
          error={error}
          onType={(next) => {
            setText(next);
            onTyping(key);
          }}
          onCommit={commit}
        />
      </div>
      {error ? (
        <p id={`${id}-code-error`} role="alert" className="text-sm text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SwatchProps = Readonly<{ row: ColourRow; id: string; onPick: (panelId: string, swatch: string) => void; onSettle: (panelId: string) => void }>;

function SwatchInput({ row, id, onPick, onSettle }: SwatchProps) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {row.label} colour
      </label>
      <input
        key={row.swatch}
        id={id}
        type="color"
        defaultValue={row.swatch}
        onChange={(event) => onPick(row.panelId, event.target.value)}
        onBlur={() => onSettle(row.panelId)}
        className="size-11 cursor-pointer rounded-lg border border-hairline bg-surface p-1"
      />
    </>
  );
}

type CodeProps = Readonly<{
  id: string;
  fieldKey: string;
  label: string;
  text: string;
  error: string | null;
  onType: (text: string) => void;
  onCommit: (asked: boolean) => void;
}>;

function CodeInput({ id, fieldKey, label, text, error, onType, onCommit }: CodeProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label} colour code
      </label>
      <input
        id={id}
        data-field={fieldKey}
        type="text"
        autoComplete="off"
        placeholder="Colour name or code"
        value={text}
        onChange={(event) => onType(event.target.value)}
        onBlur={() => onCommit(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(true);
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 min-w-0 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink aria-[invalid]:border-warn"
      />
    </div>
  );
}

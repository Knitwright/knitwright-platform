"use client";

import { useId } from "react";
import { normaliseSwatch, type ColourChange, type ColourRow } from "@/lib/projects/colour-controls";
import { colourKey } from "./keys";
import { useColourFields } from "./useColourFields";

type ColourControlsProps = Readonly<{
  rows: readonly ColourRow[];
  errorFor: (key: string) => string | null;
  onPickSwatch: (panelId: string, swatch: string) => void;
  onSettleSwatch: (panelId: string) => void;
  onChangeText: (panelId: string, change: ColourChange, asked: boolean) => void;
  onTyping: (key: string) => void;
  onDirty: (key: string, dirty: boolean) => void;
}>;

/** A drawn colour and a colour code for each part of the design. Markup and wiring only. */
export function ColourControls({ rows, errorFor, ...handlers }: ColourControlsProps) {
  return (
    <ul className="grid gap-3 @xl:grid-cols-2">
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
  const fields = useColourFields(row, onDirty);
  const errorId = error ? `${id}-error` : undefined;
  const commitCode = (asked: boolean) => {
    if (fields.text.trim() !== fields.serverText) onChangeText(row.panelId, { colourText: fields.text }, asked);
  };
  const commitHex = (asked: boolean) => {
    if (fields.hex.trim() !== fields.serverHex) onChangeText(row.panelId, { swatch: normaliseSwatch(fields.hex) }, asked);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-ink">{row.label}</legend>
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-picker`} className="text-sm text-ink-2">
            Drawn colour
          </label>
          <input
            key={row.swatch}
            id={`${id}-picker`}
            type="color"
            defaultValue={row.swatch}
            aria-label={`${row.label} colour`}
            aria-describedby={errorId}
            onChange={(event) => {
              fields.setHex(event.target.value);
              onPickSwatch(row.panelId, event.target.value);
            }}
            onBlur={() => onSettleSwatch(row.panelId)}
            className="size-11 cursor-pointer rounded-lg border border-hairline bg-surface p-1"
          />
        </div>
        <TextInput
          id={`${id}-hex`}
          label={`${row.label} drawn colour as #rrggbb`}
          shownLabel="As #rrggbb"
          placeholder="#rrggbb"
          value={fields.hex}
          mono
          errorId={errorId}
          onType={(next) => {
            fields.setHex(next);
            onTyping(fields.key);
          }}
          onCommit={commitHex}
        />
      </div>
      <TextInput
        id={`${id}-code`}
        label={`${row.label} colour code`}
        shownLabel="Colour name or code"
        placeholder="For example Navy 19-4052"
        value={fields.text}
        fieldKey={fields.key}
        errorId={errorId}
        onType={(next) => {
          fields.setText(next);
          onTyping(fields.key);
        }}
        onCommit={commitCode}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-warn">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

type TextInputProps = Readonly<{
  id: string;
  label: string;
  shownLabel: string;
  placeholder: string;
  value: string;
  fieldKey?: string;
  mono?: boolean;
  errorId: string | undefined;
  onType: (text: string) => void;
  onCommit: (asked: boolean) => void;
}>;

function TextInput({ id, label, shownLabel, placeholder, value, fieldKey, mono, errorId, onType, onCommit }: TextInputProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-sm text-ink-2">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true">{shownLabel}</span>
      </label>
      <input
        id={id}
        data-field={fieldKey}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onType(event.target.value)}
        onBlur={() => onCommit(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(true);
          }
        }}
        aria-describedby={errorId}
        className={`h-11 min-w-0 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

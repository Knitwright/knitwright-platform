"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { ARTBOARD_UNITS, mainMenu, UNIT_LABELS, type ArtboardUnit, type MenuCommand } from "@/lib/launch";

type Props = Readonly<{
  projectId: string;
  unit: ArtboardUnit;
  busy: boolean;
  onUnit: (unit: ArtboardUnit) => void;
  onCommand: (command: MenuCommand) => void;
}>;

/**
 * The main menu (spec Launch shell, "Main menu (≡)"): New project, My projects, Duplicate,
 * Settings, Save and Version history. Every item is a page that exists or a command the shell
 * carries out, as the editor's File menu holds (`lib/editor/file-menu.ts`).
 *
 * Settings opens in place and holds the one setting the spec names here: the project's unit,
 * millimetres among them. Anything else would be a setting nobody asked for.
 */
export function MainMenu({ projectId, unit, busy, onUnit, onCommand }: Props) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const items = mainMenu(projectId);

  const choose = (id: string) => {
    setOpen(false);
    if (id === "settings") return setSettingsOpen(true);
    onCommand(id as MenuCommand);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="launch-main-menu"
        data-testid="launch-menu-button"
        className="chip-btn inline-flex h-10 items-center rounded-full border border-white/20 bg-transparent px-4 text-sm font-medium text-ink"
      >
        Menu
      </button>

      {open ? (
        <ul id="launch-main-menu" aria-label="Main menu" className="glass absolute left-0 z-30 mt-2 flex w-56 flex-col rounded-2xl p-2 shadow-lg">
          {items.map((item) =>
            item.kind === "page" ? (
              <li key={item.id}>
                <Link href={item.href as Route} onClick={() => setOpen(false)} className="flex min-h-10 items-center rounded-xl px-3 text-sm text-ink hover:bg-tile-2">
                  {item.label}
                </Link>
              </li>
            ) : (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    event.preventDefault();
                    choose(item.id);
                  }}
                  className="flex min-h-10 w-full items-center rounded-xl px-3 text-left text-sm text-ink hover:bg-tile-2 disabled:cursor-not-allowed disabled:opacity-55"
                  data-testid={`launch-menu-${item.id}`}
                >
                  {item.label}
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {settingsOpen ? (
        <div role="group" aria-label="Settings" className="glass absolute left-0 z-30 mt-2 flex w-64 flex-col gap-2 rounded-2xl p-3 shadow-lg" data-testid="launch-settings">
          <h2 className="text-sm font-medium text-ink">Settings</h2>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[13px] text-ink-2">Units</legend>
            {ARTBOARD_UNITS.map((one) => (
              <label key={one} className="flex min-h-10 items-center gap-2 text-[13px] text-ink">
                <input type="radio" name="launch-unit" value={one} checked={one === unit} disabled={busy} onChange={() => onUnit(one)} className="size-4 accent-cobalt" />
                {UNIT_LABELS[one]}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="chip-btn inline-flex min-h-10 items-center justify-center rounded-full border border-white/20 text-[13px] text-ink"
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}

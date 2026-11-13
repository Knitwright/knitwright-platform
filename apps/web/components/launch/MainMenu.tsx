"use client";

import { Check, Menu as MenuIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import { FloatingMenu, MENU_ROW, MenuRule } from "@/components/editor-chrome/FloatingMenu";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { ARTBOARD_UNITS, mainMenu, UNIT_LABELS, type ArtboardUnit, type MenuCommand } from "@/lib/launch";

type Props = Readonly<{
  projectId: string;
  unit: ArtboardUnit;
  busy: boolean;
  labels: boolean;
  onUnit: (unit: ArtboardUnit) => void;
  onLabels: (labels: boolean) => void;
  onCommand: (command: MenuCommand) => void;
}>;

/**
 * THE ≡ MAIN MENU (`08` §5.7; prototype "m-ham"; decision 0146), opened to the right of the rail:
 * New project · My projects · Duplicate | Units (px, in, mm) | Menu labels | Save ⌘S · Version
 * history. Every item is a page that exists or a command the shell carries out
 * (`lib/launch/menu.ts`). Kittl's View › Grid / Rulers / Margin and Dark mode have nothing behind
 * them here and are not listed (decision 0146).
 *
 * "Settings…" is kept as the item that shows the units, so the way a person reached them before
 * still works; the units then sit in the menu as radio items rather than in a second box.
 */
export function MainMenu({ projectId, unit, busy, labels, onUnit, onLabels, onCommand }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    setUnits(false);
  }, []);
  const items = mainMenu(projectId);

  const choose = (command: MenuCommand) => {
    close();
    trigger.current?.focus();
    onCommand(command);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        data-testid="launch-menu-button"
        className={cx("grid size-10 place-items-center rounded-md text-text-2 hover:bg-soft-2", open && "bg-soft-2")}
      >
        <Icon icon={MenuIcon} />
      </button>
      <FloatingMenu id={id} label="Main menu" open={open} onClose={close} trigger={trigger} place="right" className="w-72">
        {items.map((item) =>
          item.kind === "page" ? (
            <Link key={item.id} role="menuitem" href={item.href as Route} onClick={close} className={MENU_ROW} data-testid={`launch-menu-${item.id}`}>
              {item.label}
            </Link>
          ) : item.id === "settings" ? (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              aria-expanded={units}
              onClick={() => setUnits(!units)}
              className={MENU_ROW}
              data-testid="launch-menu-settings"
            >
              Settings
              <span className="ml-auto text-small text-muted">{UNIT_LABELS[unit]}</span>
            </button>
          ) : (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => choose(item.id as MenuCommand)}
              className={MENU_ROW}
              data-testid={`launch-menu-${item.id}`}
            >
              {item.label}
              {item.id === "save" ? <kbd className="ml-auto font-sans text-small text-muted">Ctrl + S</kbd> : null}
            </button>
          ),
        )}
        {units ? (
          <div role="group" aria-label="Units" data-testid="launch-settings" className="flex flex-col">
            <MenuRule />
            {ARTBOARD_UNITS.map((one) => (
              <button
                key={one}
                type="button"
                role="menuitemradio"
                aria-checked={one === unit}
                aria-label={UNIT_LABELS[one]}
                disabled={busy}
                onClick={() => onUnit(one)}
                className={MENU_ROW}
              >
                <span className="w-5">{one === unit ? <Icon icon={Check} /> : null}</span>
                {UNIT_LABELS[one]} ({one})
              </button>
            ))}
            <p className="px-3 pb-1 text-caption text-muted">Garment boards always use millimetres.</p>
          </div>
        ) : null}
        <MenuRule />
        <button type="button" role="menuitemcheckbox" aria-checked={labels} onClick={() => onLabels(!labels)} className={MENU_ROW} data-testid="launch-menu-labels">
          Menu labels
          <span aria-hidden="true" className={cx("ml-auto h-5 w-9 rounded-full p-0.5 transition-colors", labels ? "bg-navy" : "bg-border-strong")}>
            <span className={cx("block size-4 rounded-full bg-bg transition-transform", labels && "translate-x-4")} />
          </span>
        </button>
      </FloatingMenu>
    </div>
  );
}

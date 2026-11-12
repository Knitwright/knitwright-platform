"use client";

import { Ellipsis, Plus } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { CREATE_ITEMS } from "@/lib/shell/menus";
import type { ShellPlace } from "@/lib/shell/nav";
import { MenuItemLink, MenuSeparator } from "./MenuItems";
import { RAIL_ITEM, RailLabel } from "./RailItem";
import { ShellMenu } from "./ShellMenu";

/** Create: the navy square at the top of the rail, opening `09` screen 1's menu to its right. */
export function CreateMenu() {
  return (
    <ShellMenu
      label="Create"
      side="right"
      trigger={(props) => (
        <button {...props} className={RAIL_ITEM}>
          <span className="grid size-11 place-items-center rounded-lg bg-navy text-on-dark transition-colors duration-fast live:group-hover:bg-navy-2">
            <Icon icon={Plus} size={22} />
          </span>
          <RailLabel active={false}>Create</RailLabel>
        </button>
      )}
    >
      {CREATE_ITEMS.slice(0, 3).map((item) => (
        <MenuItemLink key={item.id} href={item.href} icon={item.icon}>
          {item.label}
        </MenuItemLink>
      ))}
      <MenuSeparator />
      {CREATE_ITEMS.slice(3).map((item) => (
        <MenuItemLink key={item.id} href={item.href} icon={item.icon}>
          {item.label}
        </MenuItemLink>
      ))}
    </ShellMenu>
  );
}

type MoreMenuProps = Readonly<{ places: readonly ShellPlace[]; currentId: string | null }>;

/**
 * ⋯ at the foot of the rail: the v2.2 pages with no rail item yet. When the current page is one of
 * them the button says so in its name and takes the active square, as decision 0103's More did.
 */
export function MoreMenu({ places, currentId }: MoreMenuProps) {
  const current = places.find((place) => place.id === currentId) ?? null;
  return (
    <ShellMenu
      label="More places"
      side="right"
      align="end"
      trigger={(props) => (
        <button
          {...props}
          aria-label={current ? `More, current: ${current.label}` : "More"}
          className={cx("grid size-10 place-items-center rounded-lg text-muted live:hover:bg-soft", current && "bg-soft-2 text-text")}
        >
          <Icon icon={Ellipsis} />
        </button>
      )}
    >
      {places.map((place) => (
        <MenuItemLink key={place.id} href={place.href} icon={place.icon} current={place.id === currentId}>
          {place.label}
        </MenuItemLink>
      ))}
    </ShellMenu>
  );
}

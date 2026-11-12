"use client";

import { Menu as MenuGlyph } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { CREATE_ITEMS, WORKSPACE_ITEMS } from "@/lib/shell/menus";
import { currentId, placesFor, type Workspace } from "@/lib/shell/nav";
import { MenuItemLink, MenuSeparator } from "./MenuItems";
import { ShellMenu } from "./ShellMenu";

/**
 * A phone has no room for the rail (10 §4 breakpoints: the dashboard works down to 1024 px; the
 * phone journeys are the club and parent ones). Below `md` the rail is hidden and this one menu
 * holds everything it offers: Create's entries, every place, and the workspace's own pages.
 */
type PhoneMenuProps = Readonly<{ path: string; workspace: Workspace; helpHref: string; className?: string }>;

export function PhoneMenu({ path, workspace, helpHref, className }: PhoneMenuProps) {
  const current = currentId(path, workspace);
  return (
    <ShellMenu
      label="Menu"
      className={className}
      trigger={(props) => (
        <button {...props} aria-label="Menu" className="grid size-10 place-items-center rounded-md text-text-2 live:hover:bg-soft">
          <Icon icon={MenuGlyph} />
        </button>
      )}
    >
      {CREATE_ITEMS.map((item) => (
        <MenuItemLink key={item.id} href={item.href} icon={item.icon}>
          {item.label}
        </MenuItemLink>
      ))}
      <MenuSeparator />
      {placesFor(workspace).map(({ place }) => (
        <MenuItemLink key={place.id} href={place.href} icon={place.icon} current={place.id === current}>
          {place.label}
        </MenuItemLink>
      ))}
      <MenuSeparator />
      {WORKSPACE_ITEMS.map((item) => (
        <MenuItemLink key={item.id} href={item.href} icon={item.icon}>
          {item.label}
        </MenuItemLink>
      ))}
      <MenuItemLink href={helpHref} icon="help">
        Help
      </MenuItemLink>
    </ShellMenu>
  );
}

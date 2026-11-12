"use client";

import { ChevronDown, CircleHelp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { LogoTile } from "@/components/ui/Marks";
import { WORKSPACE_ITEMS, initialOf } from "@/lib/shell/menus";
import { RAIL, currentId, groupFor, groupStartsOpen, moreFor, type ShellPlace, type Workspace } from "@/lib/shell/nav";
import { MenuItemLink } from "./MenuItems";
import { RAIL_ITEM, RailLabel, RailLink, railSquare } from "./RailItem";
import { CreateMenu, MoreMenu } from "./RailMenus";
import { ShellMenu } from "./ShellMenu";

/**
 * The 96 px left rail (09 "Global shell", decision 0138): the logo, Create, the six places, ⌄ for
 * Orders, Store and Team, then Help, ⋯ and the workspace avatar at the foot. Hidden below `md`,
 * where the top bar's Menu holds the same places.
 */

export type RailProps = Readonly<{ workspace: Workspace; brandName: string; helpHref: string }>;

export function Rail({ workspace, brandName, helpHref }: RailProps) {
  const path = usePathname();
  return <RailView path={path} workspace={workspace} brandName={brandName} helpHref={helpHref} />;
}

/** The rail for a given address. Apart from `Rail` so it can be drawn with no router (tests, `/dev/shell`). */
export function RailView({ path, workspace, brandName, helpHref }: RailProps & Readonly<{ path: string }>) {
  const current = currentId(path, workspace);
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh w-24 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-border bg-bg pt-4.5 pb-3.5 [scrollbar-width:none] md:flex"
    >
      <Link href="/studio" aria-label="Knitwright home" className="mb-3.5 rounded-lg">
        <LogoTile className="pointer-events-none" />
      </Link>
      <CreateMenu />
      {RAIL.map((place) => (
        <RailLink key={place.id} place={place} active={place.id === current} />
      ))}
      <RailGroup places={groupFor(workspace)} current={current} startsOpen={groupStartsOpen(path, workspace)} />
      <div className="mt-auto flex flex-col items-center gap-2.5 pt-3">
        <a href={helpHref} className={RAIL_ITEM}>
          <span className={railSquare(false)}>
            <Icon icon={CircleHelp} size={22} />
          </span>
          <RailLabel active={false}>Help</RailLabel>
        </a>
        <MoreMenu places={moreFor(workspace)} currentId={current} />
        <WorkspaceMenu brandName={brandName} />
      </div>
    </nav>
  );
}

type RailGroupProps = Readonly<{ places: readonly ShellPlace[]; current: string | null; startsOpen: boolean }>;

/** ⌄: a disclosure for Orders, Store and Team. It is open whenever the current page is inside it. */
function RailGroup({ places, current, startsOpen }: RailGroupProps) {
  const id = useId();
  const [chosen, setChosen] = useState(false);
  const open = chosen || startsOpen;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Fewer places" : "Orders, Store and more"}
        onClick={() => setChosen(!open)}
        className="my-1 grid size-10 place-items-center rounded-full border border-border bg-bg text-text-2 live:hover:bg-soft"
      >
        <Icon icon={ChevronDown} size={16} className={cx("transition-transform duration-fast", open && "rotate-180")} />
      </button>
      <div id={id} hidden={!open} className="flex flex-col items-center gap-0.5">
        {places.map((place) => (
          <RailLink key={place.id} place={place} active={place.id === current} />
        ))}
      </div>
    </>
  );
}

/** The square avatar at the foot of the rail: the workspace, its Brand Studio, the switcher and credits. */
function WorkspaceMenu({ brandName }: Readonly<{ brandName: string }>) {
  return (
    <ShellMenu
      label={`Workspace: ${brandName}`}
      side="right"
      align="end"
      header={<p className="truncate px-3 pt-1 pb-2 text-small text-muted">{brandName}</p>}
      trigger={(props) => (
        <button
          {...props}
          aria-label={`Workspace: ${brandName}`}
          className="grid size-10 place-items-center rounded-md bg-link text-body font-bold text-on-dark"
        >
          {initialOf(brandName)}
        </button>
      )}
    >
      {WORKSPACE_ITEMS.map((item) => (
        <MenuItemLink key={item.id} href={item.href} icon={item.icon}>
          {item.label}
        </MenuItemLink>
      ))}
    </ShellMenu>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import type { ShellPlace } from "@/lib/shell/nav";
import { ICONS } from "./icons";

/**
 * One item of the 96 px rail (09 "Global shell", 10 §4): a 22 px icon in a 44 px rounded square,
 * a 12 px label under it. The active item's square is grey (`soft-2`); hover is `soft`.
 */

export const RAIL_ITEM = "group flex w-22 flex-col items-center gap-1 rounded-lg py-1.5 text-caption font-medium text-text-2 no-underline";

export const railSquare = (active: boolean, extra?: string): string =>
  cx(
    "grid size-11 place-items-center rounded-lg transition-colors duration-fast ease-out",
    active ? "bg-soft-2 text-text" : "live:group-hover:bg-soft",
    extra,
  );

export function RailLabel({ children, active }: Readonly<{ children: ReactNode; active: boolean }>) {
  return <span className={cx("leading-tight", active && "font-semibold text-text")}>{children}</span>;
}

export function RailLink({ place, active }: Readonly<{ place: ShellPlace; active: boolean }>) {
  return (
    <Link href={place.href} aria-current={active ? "page" : undefined} className={RAIL_ITEM} data-rail={place.id}>
      <span className={railSquare(active)}>
        <Icon icon={ICONS[place.icon]} size={22} />
      </span>
      <RailLabel active={active}>{place.label}</RailLabel>
    </Link>
  );
}

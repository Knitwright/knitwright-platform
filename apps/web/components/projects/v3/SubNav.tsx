import { Trash2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import type { ProjectSort } from "@/lib/projects-page/items";
import { SUB_TABS, type SubTabId } from "@/lib/projects-page/paths";
import { ViewControls } from "./ViewControls";

type SubNavProps = Readonly<{
  current: SubTabId;
  /** The address the sort and search apply to. */
  path: string;
  sort: ProjectSort;
  search: string;
  searchLabel?: string;
  /** A control beside the tabs, such as "New folder". */
  extra?: ReactNode;
}>;

/** The Projects tab's sub-tabs, Projects · Folders · Shared · Trash, with the sort and the search on the right (d01). */
export function SubNav({ current, path, sort, search, searchLabel = "Search projects", extra }: SubNavProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Kinds of project list" className="flex flex-wrap items-center gap-2">
        {SUB_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === current ? "page" : undefined}
            className={cx(
              "inline-flex h-13 items-center gap-2 rounded-xl px-6 text-title no-underline transition-colors duration-fast",
              tab.id === current ? "bg-soft-2 font-bold text-text" : "font-medium text-text-2 hover:bg-soft",
            )}
          >
            {tab.id === "trash" ? <Icon icon={Trash2} size={20} /> : null}
            {tab.label}
          </Link>
        ))}
        {extra}
      </nav>
      <ViewControls path={path} sort={sort} search={search} searchLabel={searchLabel} />
    </div>
  );
}

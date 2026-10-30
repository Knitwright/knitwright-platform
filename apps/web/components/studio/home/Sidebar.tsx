import type { Route } from "next";
import Link from "next/link";
import { SIDEBAR, type SidebarItem } from "@/lib/home/sidebar";
import { COMING_LATER } from "@/lib/home/targets";
import { CreateNew } from "./CreateNew";

/**
 * The studio's left sidebar (spec F-S4). Every entry is reachable by keyboard; an entry for a
 * section the platform has not built yet is shown with "Coming in a later release" beside it rather
 * than as a link that goes nowhere.
 */

const ROW = "flex min-h-10 flex-col justify-center rounded-2xl px-3 py-1.5 text-[14.5px] no-underline";

function Row({ item }: Readonly<{ item: SidebarItem }>) {
  if (item.target.kind === "new-design") return <CreateNew label={item.label} />;

  if (item.target.kind === "later") {
    return (
      <span className={`${ROW} text-muted`}>
        {/* The label is its own element, so it can be found by exactly the words a reader sees. */}
        <span>{item.label}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">{COMING_LATER}</span>
      </span>
    );
  }

  const label = item.hint ? (
    <>
      {item.label}
      <span className="text-[11.5px] text-faint">{item.hint}</span>
    </>
  ) : (
    item.label
  );

  if (item.target.kind === "external") {
    return (
      <a href={item.target.href} className={`${ROW} nav-pill text-ink-2`}>
        {label}
      </a>
    );
  }
  return (
    <Link href={item.target.href as Route} className={`${ROW} nav-pill text-ink-2`}>
      {label}
    </Link>
  );
}

export function StudioSidebar() {
  return (
    <nav aria-label="Studio sections" className="glass flex flex-col gap-4 rounded-[1.75rem] p-3">
      {SIDEBAR.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          {group.label ? (
            <h2 className="px-3 pb-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{group.label}</h2>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.id}>
                <Row item={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

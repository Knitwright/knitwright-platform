"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentNote } from "@/lib/shell/menu-a11y";
import {
  currentInOverflow,
  isCurrent,
  overflowSections,
  pillSections,
  STUDIO_SECTIONS,
  type StudioSection,
} from "@/lib/shell/sections";
import { GlassMenu } from "./GlassMenu";

/**
 * The studio's sections. A section is current for its own page and the pages under it.
 *
 * In the bar the first four are pills and the rest are listed in a "More" menu, because the bar is
 * held to 1110 px at every desktop width and seven pills alone took 625 px of it (decision 0103).
 * `stacked` lays every section out for the bar's compact menu, which is what a phone gets.
 */

const PILL = "nav-pill flex min-h-10 items-center rounded-full px-4 text-[15px] no-underline";

function SectionLink({ section, current }: Readonly<{ section: StudioSection; current: boolean }>) {
  return (
    <Link
      href={section.href}
      aria-current={current ? "page" : undefined}
      className={`${PILL} ${current ? "bg-white/12 text-white" : "text-muted"}`}
    >
      {section.label}
    </Link>
  );
}

export function StudioNav({ stacked = false }: Readonly<{ stacked?: boolean }>) {
  const path = usePathname();

  if (stacked) {
    return (
      <nav aria-label="Studio" className="flex flex-col gap-1">
        {STUDIO_SECTIONS.map((section) => (
          <SectionLink key={section.href} section={section} current={isCurrent(section, path)} />
        ))}
      </nav>
    );
  }

  const inMenu = currentInOverflow(path);

  return (
    <div className="flex items-center gap-1">
      <nav aria-label="Studio" className="flex items-center gap-1">
        {pillSections().map((section) => (
          <SectionLink key={section.href} section={section} current={isCurrent(section, path)} />
        ))}
      </nav>
      {/* The button says which section is current when that section is one of its own. */}
      <GlassMenu label="More" panelLabel="More sections" note={currentNote(inMenu)} current={inMenu !== null}>
        <nav aria-label="More studio sections" className="flex flex-col gap-1">
          {overflowSections().map((section) => (
            <SectionLink key={section.href} section={section} current={isCurrent(section, path)} />
          ))}
        </nav>
      </GlassMenu>
    </div>
  );
}

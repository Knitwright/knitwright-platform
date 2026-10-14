"use client";

import { useId, type ReactNode } from "react";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { sectionSearch, type FileSection, type FileSectionId } from "@/lib/projects/tech-pack-sections";

type NavProps = Readonly<{
  sections: readonly FileSection[];
  active: FileSectionId;
  baseSearch: string;
  summary: ReactNode;
  onPick: (id: FileSectionId) => void;
}>;

/** How many things a section still needs, in a few words. */
const leftWords = (left: number): string => (left === 0 ? "none left" : `${left} left`);

function SectionLink({ section, current, baseSearch }: Readonly<{ section: FileSection; current: boolean; baseSearch: string }>) {
  const waiting = section.left > 0;
  return (
    <a
      href={sectionSearch(baseSearch, section.id)}
      data-file-section-link={section.id}
      aria-current={current ? "page" : undefined}
      className={`nav-pill flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink ${current ? "bg-tile-2" : ""}`}
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${waiting ? "bg-warn" : "bg-faint/50"}`} />
      <span className="min-w-0 flex-1">{section.label}</span>
      <span className={`font-mono text-xs ${waiting ? "text-warn" : "text-faint"}`}>
        <span className="sr-only">, </span>
        {leftWords(section.left)}
      </span>
    </a>
  );
}

/**
 * The sections of the factory file. From the large breakpoint up it is a list down the left with
 * what each section still needs; on a phone it is one list of choices at the top, so the page never
 * scrolls sideways.
 */
export function FileSectionNav({ sections, active, baseSearch, summary, onPick }: NavProps) {
  const selectId = useId();
  const current = sections.find((section) => section.id === active);
  return (
    <aside className="glass flex min-w-0 flex-col gap-4 rounded-3xl p-4 sm:p-5 lg:sticky lg:top-24">
      {summary}
      <nav aria-label="Sections of the tech pack" data-file-nav className="hidden flex-col gap-1 lg:flex">
        {sections.map((section) => (
          <SectionLink key={section.id} section={section} current={section.id === active} baseSearch={baseSearch} />
        ))}
      </nav>
      <div className="flex flex-col gap-1.5 lg:hidden">
        <label htmlFor={selectId} className="text-sm font-medium text-ink">
          Section
        </label>
        <select
          id={selectId}
          value={current ? active : ""}
          onChange={(event) => {
            const picked = sections.find((section) => section.id === event.target.value);
            if (picked) onPick(picked.id);
          }}
          className={`${FIELD_CONTROL} w-full min-w-0`}
        >
          {current ? null : <option value="">What is left</option>}
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {`${section.label} (${leftWords(section.left)})`}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}

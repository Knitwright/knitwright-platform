"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ArrowMark } from "@/components/ui/ArrowMark";
import { FILE_SECTION_IDS, parseSection, sectionOfLink, sectionSearch, type FileSection, type FileSectionId } from "@/lib/projects/tech-pack-sections";
import { FileSectionNav } from "./FileSectionNav";

type FileTabsProps = Readonly<{
  sections: readonly FileSection[];
  /** The section the address named when the page was made. */
  initial: FileSectionId;
  /** The query the page was made with, less the section, so a link to a section keeps the colourway. */
  baseSearch: string;
  /** The ring, the count of what is left and "Accept all suggestions", above the list. */
  summary: ReactNode;
  panels: Readonly<Partial<Record<FileSectionId, ReactNode>>>;
}>;

const isSection = (value: string | undefined): value is FileSectionId => FILE_SECTION_IDS.some((id) => id === value);

/** The section that holds an element of the page, or null when it is in none. */
const sectionHolding = (element: Element | null): FileSectionId | null => {
  const id = element?.closest<HTMLElement>("[data-file-section]")?.dataset.fileSection;
  return isSection(id) ? id : null;
};

/**
 * The factory file one section at a time. Every section is on the page, so a form keeps what is
 * typed in it when the person looks at another section; only the chosen one is shown. The address
 * keeps the section (?section=), so a link, a reload and the back button all return to it.
 *
 * A link to a section is a real link, so it works before the script has loaded. A link to a place
 * inside a hidden section, such as "#construction" in the list of what is left, shows that section
 * first, at once, so the form opener can open and focus its form.
 */
export function FileTabs({ sections, initial, baseSearch, summary, panels }: FileTabsProps) {
  const [active, setActive] = useState<FileSectionId>(initial);
  const ids = [...sections.map((section) => section.id), "left" as const];

  const show = useCallback((id: FileSectionId, mode: "push" | "replace", hash = "") => {
    flushSync(() => setActive(id));
    // The place is written with the section: the router rewrites the address once it has caught up
    // with this one, and an address with no place would drop the one the browser moves to next.
    const address = `${window.location.pathname}${sectionSearch(window.location.search, id)}${hash}`;
    if (mode === "push") window.history.pushState(null, "", address);
    else window.history.replaceState(null, "", address);
  }, []);

  useEffect(() => {
    const available = [...sections.map((section) => section.id), "left" as const];
    const sameFileSection = (link: HTMLAnchorElement): FileSectionId | null =>
      link.target === "" && !link.hasAttribute("download") ? sectionOfLink(link.href, new URL(window.location.href), available) : null;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a");
      if (!link) return;
      // A link of the page itself names its section; a link elsewhere on the page, such as the
      // "Quote" step of the journey, may be an address of this file with a section in it.
      const tagged = link.dataset.fileSectionLink;
      const named = isSection(tagged) ? tagged : sameFileSection(link);
      if (named) {
        event.preventDefault();
        show(named, "push");
        if (!link.closest("[data-file-nav]")) document.querySelector(`[data-file-section="${named}"]`)?.scrollIntoView({ block: "start" });
        return;
      }
      const hash = link.getAttribute("href");
      if (!hash?.startsWith("#") || hash.length < 2) return;
      const holder = sectionHolding(document.getElementById(hash.slice(1)));
      // The browser then moves to the place, and the form opener opens its form.
      if (holder) show(holder, "replace", hash);
    };
    // Capture, so the section is shown before the form opener looks for the form in it.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [show, sections]);

  useEffect(() => {
    const fromAddress = () => {
      const named = new URLSearchParams(window.location.search).get("section") ?? undefined;
      const holder = window.location.hash.length > 1 ? sectionHolding(document.getElementById(window.location.hash.slice(1))) : null;
      setActive(holder ?? parseSection(named, ids));
    };
    if (window.location.hash.length > 1) fromAddress();
    window.addEventListener("popstate", fromAddress);
    return () => window.removeEventListener("popstate", fromAddress);
    // The list of sections only changes with a new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const index = sections.findIndex((section) => section.id === active);
  const next = index >= 0 ? sections[index + 1] : sections[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      <FileSectionNav sections={sections} active={active} baseSearch={baseSearch} summary={summary} onPick={(id) => show(id, "push")} />
      <div className="flex min-w-0 flex-col gap-4">
        {ids.map((id) => (
          <div key={id} data-file-section={id} hidden={id !== active} className="flex min-w-0 flex-col gap-6">
            {panels[id] ?? null}
          </div>
        ))}
        {next ? (
          <div className="flex justify-end">
            <a
              href={sectionSearch(baseSearch, next.id)}
              data-file-section-link={next.id}
              className="chip-cta thread-ring inline-flex h-11 items-center gap-3 rounded-full bg-white/5 pr-1.5 pl-5 text-[15px] font-medium text-white"
            >
              <span className="chip-fill" aria-hidden="true" />
              <span className="chip-label">{`Next: ${next.label}`}</span>
              <span className="chip-disc size-8" aria-hidden="true">
                <ArrowMark />
              </span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

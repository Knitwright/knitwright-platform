import type { Route } from "next";

/**
 * The studio's sections, in the order the top bar shows them (decision 0103).
 *
 * The first `PILLS` of them are drawn as pills; the rest are listed in the bar's overflow menu,
 * where a section costs no width at all. That is why the list may grow again: before this, every
 * section was a pill, the pills alone took 625 px of the bar's 1110, and the next one pushed the
 * account controls out over the aurora where muted text is 3.35:1 and fails AA.
 *
 * A section owns one or more address prefixes, and the LONGEST prefix across the whole list wins.
 * So `/studio/charts` is Size charts rather than Designs without Designs having to list what it is
 * not: the matcher it replaced carried `&& !path.startsWith("/studio/charts")`, and a third section
 * under `/studio` would have added a second negation to it.
 */
export interface StudioSection {
  readonly href: Route;
  readonly label: string;
  /** Every address prefix that belongs to this section. */
  readonly owns: readonly string[];
}

export const STUDIO_SECTIONS: readonly StudioSection[] = [
  { href: "/studio", label: "Designs", owns: ["/studio"] },
  { href: "/templates", label: "Templates", owns: ["/templates"] },
  // Launch sits beside Designs and Templates, as decision 0091 owner question 5 asks.
  { href: "/launch", label: "Launch", owns: ["/launch"] },
  { href: "/catalogue", label: "Catalogue", owns: ["/catalogue"] },
  { href: "/studio/charts", label: "Size charts", owns: ["/studio/charts"] },
  { href: "/designer", label: "Designer", owns: ["/designer"] },
  // Teamwear was reachable only by typing its address: decision 0086 owner question 8.
  { href: "/teamwear", label: "Teamwear", owns: ["/teamwear"] },
  // And so was crest to kit, for the same reason and with the same answer: it is in the menu, where
  // a section costs the bar nothing, rather than a pill (decision 0103 item 2).
  { href: "/crest-to-kit", label: "Crest to kit", owns: ["/crest-to-kit"] },
  { href: "/club", label: "Club", owns: ["/club"] },
  { href: "/brand", label: "Brand", owns: ["/brand"] },
  // Benchmarks keeps its studio-sidebar entry too (decision 0084 item 11); this one reaches it from
  // every signed-in page rather than only from the studio home, and in the menu it costs no width.
  { href: "/studio/benchmarks", label: "Benchmarks", owns: ["/studio/benchmarks"] },
];

/** How many sections stay as pills in the top bar. The rest are listed in the overflow menu. */
export const PILLS = 4;

export const pillSections = (): readonly StudioSection[] => STUDIO_SECTIONS.slice(0, PILLS);

export const overflowSections = (): readonly StudioSection[] => STUDIO_SECTIONS.slice(PILLS);

/** Whether an address is inside a prefix: the prefix itself, or a page under it. */
const inside = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`);

/**
 * The section this address belongs to, or null when it belongs to none. The longest owned prefix
 * wins, so a section under another section's address is still its own.
 */
export const sectionFor = (path: string): StudioSection | null => {
  let found: StudioSection | null = null;
  let best = 0;
  for (const section of STUDIO_SECTIONS) {
    for (const prefix of section.owns) {
      if (inside(path, prefix) && prefix.length > best) {
        found = section;
        best = prefix.length;
      }
    }
  }
  return found;
};

/** True when this section is the one the address is in. */
export const isCurrent = (section: StudioSection, path: string): boolean => sectionFor(path) === section;

/**
 * The label of the current section when it is inside the overflow menu, so the menu's own button
 * can say which section is current while that section's pill is out of sight.
 */
export const currentInOverflow = (path: string): string | null => {
  const current = sectionFor(path);
  return current !== null && overflowSections().includes(current) ? current.label : null;
};

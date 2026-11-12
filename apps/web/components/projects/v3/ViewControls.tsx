"use client";

import { useRef } from "react";
import { SearchInput, Select } from "@/components/ui/Inputs";
import { SORT_LABELS, SORTS, type ProjectSort } from "@/lib/projects-page/items";

type ViewControlsProps = Readonly<{
  /** The address the form asks for: the sub-tab it sits on. */
  path: string;
  sort: ProjectSort;
  search: string;
  /** "Search projects", "Search folders". */
  searchLabel: string;
}>;

/**
 * The sort dropdown and the search box (09 screen 14). A plain GET form, so both work without a
 * script: Enter in the search sends it, and choosing a sort sends it at once when scripts run.
 */
export function ViewControls({ path, sort, search, searchLabel }: ViewControlsProps) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} method="get" action={path} role="search" aria-label={searchLabel} className="flex w-full flex-wrap items-center gap-3.5 lg:w-auto lg:flex-nowrap">
      <label className="sr-only" htmlFor="projects-sort">
        Sort by
      </label>
      <Select id="projects-sort" name="sort" defaultValue={sort} onChange={() => form.current?.requestSubmit()} className="w-full sm:w-44">
        {SORTS.map((value) => (
          <option key={value} value={value}>
            {SORT_LABELS[value]}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor="projects-search">
        {searchLabel}
      </label>
      <SearchInput id="projects-search" name="q" defaultValue={search} placeholder={searchLabel} maxLength={80} className="w-full sm:w-75" />
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}

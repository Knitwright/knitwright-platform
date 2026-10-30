import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import type { CatalogueFilters as Filters } from "@/lib/catalogue";
import { CLASS_NOTE, FILTER_LABELS, type FilterGroup } from "@/lib/home/catalogue-filters";

/**
 * The catalogue's filter panel (spec F-S4). A plain form that reloads the page, so it works without
 * a script and every control is labelled and reachable by keyboard. Each choice carries how many
 * articles it matches, and a group with no value on any article is never drawn.
 */

type PanelProps = Readonly<{
  groups: readonly FilterGroup[];
  filters: Filters;
  search: string;
  /** The parts of the address the panel keeps: the tab, the sort and the market. */
  keep: Readonly<Record<string, string>>;
  /** Why a group is missing, where one is. */
  note: string | null;
}>;

export function CatalogueFilters({ groups, filters, search, keep, note }: PanelProps) {
  const chosen = filters as Readonly<Record<string, string | undefined>>;

  return (
    <form method="get" action="/catalogue" role="search" aria-label="Filter the catalogue" className="glass flex flex-col gap-4 rounded-[1.6rem] p-5">
      <h2 className="text-[15px] font-medium text-ink">Filters</h2>
      {Object.entries(keep).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="catalogue-q" className="text-sm font-medium text-ink">
          Search
        </label>
        <input
          id="catalogue-q"
          type="search"
          name="q"
          defaultValue={search}
          placeholder="A name or a code"
          className="h-11 rounded-xl border border-hairline bg-white/[0.04] px-4 text-[15px] text-ink placeholder:text-faint focus-visible:border-cobalt-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt-soft"
        />
      </div>
      {groups.map((group) => (
        <SelectField
          key={group.key}
          name={group.key}
          label={FILTER_LABELS[group.key]}
          placeholder={`Any ${FILTER_LABELS[group.key].toLowerCase()}`}
          defaultValue={chosen[group.key] ?? ""}
          hint={group.key === "productionClass" ? CLASS_NOTE : undefined}
          options={group.options.map((option) => ({ id: option.value, label: `${option.label} (${option.count})` }))}
        />
      ))}
      {note ? <p className="text-[13px] text-muted">{note}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary">
          Show products
        </Button>
        <Link href={`/catalogue?${new URLSearchParams(keep).toString()}` as Route} className="soft-link text-sm text-muted">
          Clear filters
        </Link>
      </div>
    </form>
  );
}

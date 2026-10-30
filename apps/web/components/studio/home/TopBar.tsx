import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { COMING_LATER } from "@/lib/home/targets";

/**
 * The studio home's own top bar (spec F-S4, "Top bar"): the search that opens the catalogue, and
 * notifications. The credits counter the spec asks for is already in the studio header, and one
 * brand has one balance, so it is not drawn twice. The search is a plain form, so it works without
 * a script. Notifications are not built yet, so the chip says so instead of pretending to be a bell.
 */
export function StudioTopBar({ defaultSearch = "" }: Readonly<{ defaultSearch?: string }>) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form method="get" action="/catalogue" role="search" aria-label="Search the library" className="flex min-w-0 flex-1 items-center gap-2">
        <label htmlFor="studio-search" className="sr-only">
          Search templates, base products, fabrics, or more
        </label>
        <input
          id="studio-search"
          type="search"
          name="q"
          defaultValue={defaultSearch}
          placeholder="Search templates, base products, fabrics, or more"
          className={`${FIELD_CONTROL} min-w-0 flex-1`}
        />
        <button type="submit" className="chip-btn inline-flex min-h-10 items-center rounded-full border border-white/20 px-4 text-sm font-medium text-ink">
          Search
        </button>
      </form>
      <span className="inline-flex min-h-10 items-center rounded-full border border-white/12 px-3.5 text-[13px] text-muted">
        Notifications: {COMING_LATER.toLowerCase()}
      </span>
    </div>
  );
}

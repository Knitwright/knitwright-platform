import { LayoutTemplate, SlidersHorizontal } from "lucide-react";
import type { Route } from "next";
import { TemplateFilters } from "@/components/templates/TemplateFilters";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/PageStates";
import { buttonClasses } from "@/components/ui/Button";
import type { TemplateFilters as Filters } from "@/lib/templates/filters";
import type { FeedView } from "@/lib/templates/feed/rows";
import { tabHref, type TemplateTab } from "@/lib/templates/feed/tabs";
import { TemplateGrid, TemplateRow } from "./TemplateRows";
import { TemplatesHeader } from "./TemplatesHeader";

export type TemplatesViewProps = Readonly<{
  tab: TemplateTab;
  search: string;
  view: FeedView;
  /** The older design filters, for the Filters panel. */
  filters: Filters;
  articles: readonly Readonly<{ id: string; label: string }>[];
  /** True when the library holds nothing at all. */
  empty: boolean;
}>;

/** The Filters button of 08 §4.2: sport, garment, style and colour, as the plain form the library always had. */
function FiltersPanel({ filters, articles }: Pick<TemplatesViewProps, "filters" | "articles">) {
  const open = Object.keys(filters).length > 0;
  return (
    <details open={open} className="group">
      <summary className={buttonClasses("secondary", false, "cursor-pointer list-none [&::-webkit-details-marker]:hidden", "sm")}>
        <Icon icon={SlidersHorizontal} size={16} />
        Filters
      </summary>
      <div className="mt-3 rounded-xl border border-border bg-bg p-4">
        <TemplateFilters filters={filters} articles={articles} />
      </div>
    </details>
  );
}

function Content({ tab, view, search }: Pick<TemplatesViewProps, "tab" | "view" | "search">) {
  if (view.layout === "rows") return view.rows.map((row) => <TemplateRow key={row.id} row={row} />);
  if (view.items.length > 0) return <TemplateGrid title={view.title} items={view.items} />;
  return (
    <EmptyState
      icon={<Icon icon={LayoutTemplate} size={22} />}
      title="No template matches"
      action={<LinkButton href={tabHref(tab) as Route}>{search === "" ? "Show every template" : "Clear the search"}</LinkButton>}
    >
      No template matches those filters. Try other words, or start from a blank canvas.
    </EmptyState>
  );
}

/** The v3.9 Templates page (09 screen 7, decision 0140), drawn from data the page has already read. */
export function TemplatesView(props: TemplatesViewProps) {
  return (
    <div className="flex flex-col gap-8 pt-1">
      <TemplatesHeader tab={props.tab} search={props.search} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FiltersPanel filters={props.filters} articles={props.articles} />
        <LinkButton href="/studio/start" variant="secondary" size="sm">
          Start from a blank canvas
        </LinkButton>
      </div>
      {props.empty ? (
        <EmptyState
          icon={<Icon icon={LayoutTemplate} size={22} />}
          title="No templates yet"
          action={<LinkButton href="/studio/start">Start from a blank canvas</LinkButton>}
        >
          The library is empty for now. Start a design from a garment instead.
        </EmptyState>
      ) : (
        <Content tab={props.tab} view={props.view} search={props.search} />
      )}
      <p className="text-caption text-muted">
        Knitwright starters are not reviewed by a factory unless the card says so. Using a template makes your own copy; the template stays as it is.
      </p>
    </div>
  );
}

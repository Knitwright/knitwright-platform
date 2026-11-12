import type { Route } from "next";
import Link from "next/link";
import { SearchInput } from "@/components/ui/Inputs";
import { cx } from "@/components/ui/cx";
import { TEMPLATE_TABS, TEMPLATE_TAB_LABELS, tabHref, type TemplateTab } from "@/lib/templates/feed/tabs";

/**
 * The grey header band of the Templates page (09 screen 7): the headline, the search and the
 * category tabs. The search is a plain form that reloads the page, so it works before the page is
 * interactive; it searches the tab it was typed on. The tabs are links, so each one has an address.
 */
export function TemplatesHeader({ tab, search }: Readonly<{ tab: TemplateTab; search: string }>) {
  return (
    <header className="flex flex-col items-center gap-6 rounded-3xl bg-soft px-6 pt-10 pb-0 md:px-10">
      <h1 className="text-center text-h1 text-text">Templates for every sport, ready to edit</h1>
      <form method="get" action="/templates" role="search" aria-label="Search templates" className="w-full max-w-155">
        {tab === "discover" ? null : <input type="hidden" name="tab" value={tab} />}
        <label htmlFor="template-search" className="sr-only">
          Search templates
        </label>
        <SearchInput id="template-search" name="q" defaultValue={search} placeholder={'Try "retro football kit" or "matchday poster"'} />
      </form>
      <nav aria-label="Template categories" className="-mx-2 flex max-w-full gap-6 self-stretch overflow-x-auto px-2">
        {TEMPLATE_TABS.map((one) => (
          <Link
            key={one}
            href={tabHref(one) as Route}
            aria-current={one === tab ? "page" : undefined}
            className={cx(
              "inline-flex min-w-10 justify-center border-b-2 pt-2 pb-4 text-body-lg font-semibold whitespace-nowrap no-underline transition-colors duration-fast",
              one === tab ? "border-text text-text" : "border-transparent text-muted live:hover:text-text",
            )}
          >
            {TEMPLATE_TAB_LABELS[one]}
          </Link>
        ))}
      </nav>
    </header>
  );
}

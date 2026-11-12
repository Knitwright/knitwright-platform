import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Inputs";
import type { Category, SubCategory } from "@/lib/products/categories";
import type { CategoryView } from "@/lib/products/category";
import { UNAVAILABLE_FILTERS } from "@/lib/products/category";
import { categoryHref, PRODUCTS_PATH } from "@/lib/products/routes";
import { LockedButton } from "./LockedButton";
import { ProductRender } from "./ProductRender";

/** The parts of a category page (09 screen 22; prototype p02). */

/** "← Catalogue", then the grey hero with its breadcrumb, title, count and a garment. */
export function CategoryHero({ category, typeId }: Readonly<{ category: Category; typeId: string | null }>) {
  return (
    <>
      <Link href={PRODUCTS_PATH} className="inline-flex w-fit items-center gap-2 pt-6 text-h3 text-text-2 no-underline hover:text-text">
        <Icon icon={ArrowLeft} size={20} />
        Catalogue
      </Link>
      <section className="flex items-center justify-between gap-6 rounded-2xl bg-soft px-8 py-8">
        <div className="flex flex-col gap-3">
          <nav aria-label="Breadcrumb">
            <ol className="flex gap-1 text-small text-muted">
              <li>
                <Link href={PRODUCTS_PATH} className="text-muted hover:text-text">
                  Catalogue
                </Link>
                <span aria-hidden="true"> ›</span>
              </li>
              <li aria-current="page">{category.label}</li>
            </ol>
          </nav>
          <h1 className="text-display text-text">{category.label}</h1>
          <p className="text-body-lg font-normal text-text-2">
            {category.count} base{category.count === 1 ? "" : "s"} · made to order by Knitwright
          </p>
        </div>
        <span aria-hidden="true" className="hidden size-28 place-items-center sm:grid">
          <ProductRender typeId={typeId} className="w-full" />
        </span>
      </section>
    </>
  );
}

/** The sub-category chips: each article type in the category, with a thumbnail, as a link that keeps the filters. */
export function SubCategoryChips({ slug, subs, chosen, keep, typeOf }: Readonly<{ slug: string; subs: readonly SubCategory[]; chosen: string | null; keep: Readonly<Record<string, string>>; typeOf: (type: string) => string | null }>) {
  const rest = Object.fromEntries(Object.entries(keep).filter(([key]) => key !== "articleType"));
  return (
    <nav aria-label="Product types">
      <ul className="flex flex-wrap gap-3">
        {subs.map((sub) => {
          const on = sub.type === chosen;
          return (
            <li key={sub.type}>
              <Link
                href={categoryHref(slug, on ? rest : { ...rest, articleType: sub.type })}
                aria-current={on ? "true" : undefined}
                className={cx("flex h-13 items-center gap-3 rounded-lg border pr-4 pl-1.5 text-body font-medium no-underline", on ? "border-navy bg-navy text-on-dark" : "border-border text-text hover:bg-soft")}
              >
                <span className="grid size-10 place-items-center overflow-hidden rounded-md bg-soft">
                  <ProductRender typeId={typeOf(sub.type)} className="w-8" />
                </span>
                {sub.label} <span className={on ? "text-on-dark" : "text-muted"}>· {sub.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The filter bar: a dropdown per filter the rows can back, Decoration and Price switched off with the reason, and
 * Sort on the right. It is a plain GET form, so it works before the page is interactive.
 */
export function FilterBar({ slug, view }: Readonly<{ slug: string; view: CategoryView }>) {
  return (
    <form method="get" action={categoryHref(slug)} aria-label="Filter the products" className="flex flex-wrap items-center gap-3 border-y border-border py-3">
      <span className="flex items-center gap-2 text-body font-semibold text-text">
        <Icon icon={SlidersHorizontal} size={20} />
        Filters
      </span>
      {view.articleType ? <input type="hidden" name="articleType" value={view.articleType} /> : null}
      {view.search ? <input type="hidden" name="q" value={view.search} /> : null}
      {view.bar.map((group) => (
        <label key={group.key} className="flex items-center gap-2 text-small font-medium text-text-2">
          <span className="sr-only">{group.label}</span>
          <Select name={group.key} defaultValue={group.chosen ?? ""} className="w-44">
            <option value="">{group.label}: all</option>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>{`${option.label} (${option.count})`}</option>
            ))}
          </Select>
        </label>
      ))}
      {UNAVAILABLE_FILTERS.map((filter) => (
        <LockedButton key={filter.label} variant="ghost" reason={filter.reason}>
          {filter.label}
        </LockedButton>
      ))}
      <label className="ml-auto flex items-center gap-2 text-small font-medium text-text-2">
        Sort
        <Select name="sort" defaultValue={view.sort} className="w-44">
          {view.sorts.map((sort) => (
            <option key={sort.id} value={sort.id}>
              {sort.label}
            </option>
          ))}
        </Select>
      </label>
      <Button type="submit" variant="secondary">
        Show products
      </Button>
    </form>
  );
}

/** The pager under the grid: Previous, "Page 1 of 2", Next, each keeping the filters. Hidden for one page. */
export function Pager({ slug, view }: Readonly<{ slug: string; view: CategoryView }>) {
  if (view.totalPages <= 1) return null;
  const to = (page: number) => categoryHref(slug, page <= 1 ? view.keep : { ...view.keep, page: String(page) });
  const link = "inline-flex h-10 items-center rounded-md border border-border px-4 text-body font-semibold text-text no-underline hover:bg-soft";
  return (
    <nav aria-label="Pages of products" className="flex items-center justify-center gap-4">
      {view.page > 1 ? (
        <Link href={to(view.page - 1)} rel="prev" className={link}>
          Previous
        </Link>
      ) : null}
      <span className="text-body text-muted">{`Page ${view.page} of ${view.totalPages}`}</span>
      {view.page < view.totalPages ? (
        <Link href={to(view.page + 1)} rel="next" className={link}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}

import { Package, Pencil, Truck } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/ui/Chips";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/PageStates";
import { Icon } from "@/components/ui/Icon";
import { SearchInput } from "@/components/ui/Inputs";
import { LinkButton } from "@/components/ui/LinkButton";
import { Table, Td, Th, Tr } from "@/components/ui/Table";
import { MY_PRODUCTS_PATH, PRODUCTS_PATH } from "@/lib/products/routes";
import { STAGE_TONES, type ProductRow, type StageChip, type StageFilter } from "@/lib/products/mine";

/** My products (09 screen 10, prototype p05): the stage chips, the search, and one row per product. */

export function StageChips({ chips, current }: Readonly<{ chips: readonly StageChip[]; current: StageFilter }>) {
  return (
    <nav aria-label="Product stages">
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const on = chip.id === current;
          return (
            <li key={chip.id}>
              <Link
                href={chip.href}
                aria-current={on ? "true" : undefined}
                className={cx("inline-flex h-10 items-center rounded-full border px-4 text-body font-medium no-underline", on ? "border-navy bg-navy text-on-dark" : "border-border text-text hover:bg-soft")}
              >
                {`${chip.label} (${chip.count})`}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ProductSearch({ stage, search }: Readonly<{ stage: StageFilter; search: string }>) {
  return (
    <form method="get" action={MY_PRODUCTS_PATH} role="search" aria-label="Search your products" className="w-full sm:w-80">
      {stage === "all" ? null : <input type="hidden" name="stage" value={stage} />}
      <label htmlFor="product-search" className="sr-only">
        Search products
      </label>
      <SearchInput id="product-search" name="q" defaultValue={search} maxLength={80} placeholder="Search products" />
    </form>
  );
}

export function ProductTable({ rows }: Readonly<{ rows: readonly ProductRow[] }>) {
  return (
    <Table caption="Your products">
      <thead>
        <tr>
          <Th>Product</Th>
          <Th>Status</Th>
          <Th>Updated</Th>
          <Th>Sales channels</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="py-3">
              <span className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-lg border border-border bg-soft text-muted">
                  <Icon icon={Package} size={22} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-text" title={row.name}>
                    {row.name}
                  </span>
                  <span className="text-caption text-muted">{row.detail}</span>
                </span>
              </span>
            </Td>
            <Td>
              <StatusPill tone={STAGE_TONES[row.stage]}>{row.stageLabel}</StatusPill>
            </Td>
            <Td>{row.updated}</Td>
            <Td className="text-small text-muted">{row.channel}</Td>
            <Td>
              <span className="flex justify-end gap-1">
                <Link href={row.editHref} aria-label={`Edit ${row.name}`} className="grid size-9 place-items-center rounded-md text-text-2 hover:bg-soft">
                  <Icon icon={Pencil} size={20} />
                </Link>
                <Link href={row.runsHref} aria-label={`Samples and runs of ${row.name}`} className="grid size-9 place-items-center rounded-md text-text-2 hover:bg-soft">
                  <Icon icon={Truck} size={20} />
                </Link>
              </span>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/** No product yet (10 §9 Empty): one action, to the catalogue where a design starts. */
export function NoProducts({ filtered }: Readonly<{ filtered: boolean }>) {
  return filtered ? (
    <EmptyState icon={<Icon icon={Package} size={22} />} title="No product matches" action={<LinkButton href={MY_PRODUCTS_PATH}>Show all products</LinkButton>}>
      Try another stage or other words.
    </EmptyState>
  ) : (
    <EmptyState icon={<Icon icon={Package} size={22} />} title="No products yet" action={<LinkButton href={PRODUCTS_PATH}>Browse the catalogue</LinkButton>}>
      Design a kit on a base, then list it as a product on Product runs to plan a sample and a run.
    </EmptyState>
  );
}

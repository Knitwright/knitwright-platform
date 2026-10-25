import Link from "next/link";
import { creditSummaryFor } from "@/lib/credits/server";

/**
 * The brand's credit balance in the studio header, linking to the credits page. A credit problem
 * must never stop the studio opening, so a failed read shows nothing.
 */
export async function BalanceChip({ brandId }: Readonly<{ brandId: string }>) {
  const balance = await creditSummaryFor(brandId)
    .then((summary) => summary.balance)
    .catch(() => null);
  if (balance === null) return null;
  return (
    <Link
      href="/credits"
      className="nav-pill inline-flex min-h-10 shrink-0 items-center rounded-full border border-white/12 px-3.5 text-sm text-ink-2"
      data-testid="credit-balance"
    >
      <span className="sr-only">Credits: </span>
      {balance}
      <span aria-hidden="true"> credits</span>
    </Link>
  );
}

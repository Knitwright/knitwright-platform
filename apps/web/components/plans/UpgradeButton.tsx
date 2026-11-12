"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { KwCoin } from "@/components/ui/Marks";
import { openPlans, type PlansKind } from "@/lib/plans/modal-store";

/**
 * A button that opens the plans modal (decision 0144). The top bar's navy Upgrade with the KW coin
 * is the default look; `className` and `children` let Settings put the same door elsewhere.
 */
export function UpgradeButton({
  kind = "plans",
  className,
  children,
}: Readonly<{ kind?: PlansKind; className?: string; children?: ReactNode }>) {
  return (
    <button
      type="button"
      onClick={() => openPlans({ kind })}
      aria-haspopup="dialog"
      data-testid="upgrade-button"
      className={cx(
        className ??
          "hidden h-11 items-center gap-2.5 rounded-md bg-navy px-5 text-body-lg font-bold text-on-dark transition-colors duration-fast live:hover:bg-navy-2 sm:inline-flex",
      )}
    >
      {children ?? (
        <>
          <KwCoin />
          Upgrade
        </>
      )}
    </button>
  );
}

"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { frameFor } from "@/lib/shell/frame";

/**
 * The page under the top bar. v3.9 pages take the full width with 10 §4's padding; v2.2 pages keep
 * the column they were laid out for (`lib/shell/frame.ts`). Each page rises into place when it
 * opens, keyed by the address, as the v2.2 frame did.
 */
export function ShellMain({ children }: Readonly<{ children: ReactNode }>) {
  const path = usePathname();
  const frame = frameFor(path);
  return (
    <main id="main" className={cx("flex-1 px-4 pb-15 md:px-10", frame === "column" && "pt-2")}>
      <div key={path} className={cx("rise", frame === "column" && "mx-auto w-full max-w-6xl")}>
        {children}
      </div>
    </main>
  );
}

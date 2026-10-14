"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Each studio page rises into place when it opens. Keyed by the address, so the entrance plays
 * again on every page, as a template would, without a server template that must check the session
 * again before the page (or its loading skeleton) can show. Every page still checks it itself.
 */
export function PageRise({ children }: Readonly<{ children: ReactNode }>) {
  const path = usePathname();
  return (
    <div key={path} className="rise">
      {children}
    </div>
  );
}

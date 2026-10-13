"use client";

import { usePathname } from "next/navigation";
import { useRef, type KeyboardEvent, type ReactNode } from "react";

/**
 * The menu button of the header on a phone. It opens a glass panel with the sections,
 * settings and sign out. It closes again on a new page (the panel is drawn afresh for
 * each address) and on Escape, which hands focus back to the button.
 */
export function PhoneMenu({ children }: Readonly<{ children: ReactNode }>) {
  const path = usePathname();
  const details = useRef<HTMLDetailsElement>(null);

  const closeOnEscape = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== "Escape" || !details.current?.open) return;
    details.current.open = false;
    details.current.querySelector("summary")?.focus();
  };

  return (
    <details key={path} ref={details} onKeyDown={closeOnEscape} className="group relative md:hidden">
      <summary className="nav-pill flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-ink [&::-webkit-details-marker]:hidden">
        <span>Menu</span>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="transition-transform duration-300 group-open:rotate-45">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </summary>
      <div className="panel-in absolute right-0 top-[calc(100%+12px)] z-50 flex w-64 flex-col gap-2 rounded-3xl border border-white/15 bg-surface-solid/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {children}
      </div>
    </details>
  );
}

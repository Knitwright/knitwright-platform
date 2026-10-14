"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { opensAnotherPage } from "@/lib/navigation/progress";

/** After this long the line gives up, in case the move never finishes (a failed request). */
const GIVE_UP_MS = 15_000;

/**
 * A thin thread-coloured line across the top of the window from the moment a link to another
 * page is clicked until that page arrives. A page with a loading screen shows that at once and
 * the line never appears (it fades in only after a short wait). A page that must finish on the
 * server first, such as a design, which must answer "not found" for another brand's design, at
 * least shows that the click was taken.
 */
export function NavigationProgress() {
  const path = usePathname();
  const [leaving, setLeaving] = useState<string | null>(null);
  const [shown, setShown] = useState(path);

  // A new page has arrived (or the visitor went back): the line has done its job.
  if (shown !== path) {
    setShown(path);
    setLeaving(null);
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const starts = opensAnotherPage({
        href: anchor.href,
        current: window.location.href,
        button: event.button,
        modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        target: anchor.target,
        download: anchor.hasAttribute("download"),
      });
      if (starts) setLeaving(window.location.pathname);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // Still on the page the click was made on: the next one has not arrived yet.
  if (leaving === null || leaving !== path) return null;
  return <div aria-hidden="true" data-testid="navigation-progress" className="nav-progress fixed inset-x-0 top-0 z-[60] h-[2px]" />;
}

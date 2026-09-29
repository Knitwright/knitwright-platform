"use client";

import { useEffect } from "react";

/**
 * A link that leads to a section whose form is closed opens the form and moves focus to its
 * first field. The links say so with `data-opens-forms`. Nothing else on the page is changed.
 */
export function FormOpener() {
  useEffect(() => {
    const open = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-opens-forms]");
      const id = link?.getAttribute("href")?.slice(1);
      const section = id ? document.getElementById(id) : null;
      if (!section) return;
      const forms = section.querySelector<HTMLDetailsElement>("details");
      if (forms) forms.open = true;
      requestAnimationFrame(() => forms?.querySelector<HTMLElement>("input, select, textarea")?.focus());
    };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);
  return null;
}

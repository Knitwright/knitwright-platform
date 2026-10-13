"use client";

import { useEffect } from "react";

const CONTROLS = "input:not([type=hidden]), select, textarea";

/** Every closed form around an element, from the outside in, is opened, so the element can be seen. */
const openAround = (element: Element): void => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
};

/** The field to focus: the named field, else the first empty one, else the first one. */
function fieldIn(owner: HTMLElement, name: string | null): HTMLElement | null {
  if (owner.matches(CONTROLS)) return owner;
  const named = name ? owner.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`) : null;
  if (named) return named;
  const controls = [...owner.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(CONTROLS)];
  return controls.find((control) => control.value.trim() === "") ?? controls[0] ?? null;
}

/**
 * A link that leads to a section whose form is closed opens the form and moves focus to a
 * field. The links say so with `data-opens-forms`. A link may name the form and the field it
 * fills with `data-focus-form` and `data-focus-field`; otherwise the first form of the section
 * is opened. Nothing else on the page is changed.
 */
export function FormOpener() {
  useEffect(() => {
    const open = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-opens-forms]");
      const id = link?.getAttribute("href")?.slice(1);
      const section = id ? document.getElementById(id) : null;
      if (!link || !section) return;
      const formKey = link.dataset.focusForm;
      const owner = formKey ? section.querySelector<HTMLElement>(`[data-field="${CSS.escape(formKey)}"]`) : null;
      if (owner) {
        openAround(owner);
        const field = fieldIn(owner, link.dataset.focusField ?? null);
        requestAnimationFrame(() => field?.focus());
        return;
      }
      const forms = section.querySelector<HTMLDetailsElement>("details");
      if (forms) forms.open = true;
      requestAnimationFrame(() => forms?.querySelector<HTMLElement>(CONTROLS)?.focus());
    };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);
  return null;
}

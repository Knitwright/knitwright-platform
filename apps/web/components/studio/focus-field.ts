const INSIDE_A_GROUP = "input:checked, input:not([aria-disabled]), select, button";

/** Moves focus to the control with this key. Radio groups give focus to the chosen radio. */
export const focusField = (key: string): void => {
  const owner = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`);
  if (!owner) return;
  const target = owner.matches("input, select, button") ? owner : owner.querySelector<HTMLElement>(INSIDE_A_GROUP);
  target?.focus();
};

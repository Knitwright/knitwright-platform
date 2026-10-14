const INSIDE_A_GROUP = "input:checked, input:not([aria-disabled]), select, button";

/**
 * Sent from a control that should take focus but sits in a hidden panel of the workspace. The
 * workspace opens the panel, then calls focusField again.
 */
export const REVEAL_FIELD_EVENT = "kw-reveal-field";

export type RevealFieldDetail = Readonly<{ key: string }>;

/** Moves focus to the control with this key. Radio groups give focus to the chosen radio. */
export const focusField = (key: string): void => {
  const owner = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`);
  if (!owner) return;
  if (owner.closest("[hidden]")) {
    owner.dispatchEvent(new CustomEvent<RevealFieldDetail>(REVEAL_FIELD_EVENT, { bubbles: true, detail: { key } }));
    return;
  }
  const target = owner.matches("input, select, button") ? owner : owner.querySelector<HTMLElement>(INSIDE_A_GROUP);
  target?.focus();
};

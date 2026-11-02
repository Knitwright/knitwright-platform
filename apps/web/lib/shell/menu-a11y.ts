/**
 * The accessible names and states of the top bar's menus: a button that says what it opens and
 * whether it is open, and a panel the button names. Kept apart from the component so the attributes
 * are tested alone, as the "Why?" popover's are (`components/rulebook/a11y.ts`) and the create-new
 * modal's are (`components/studio/home/create-new-a11y.ts`).
 *
 * The menus are disclosures holding links, not ARIA menus: a `role="menu"` would promise arrow-key
 * navigation between `menuitem` children, and these hold ordinary links and a sign-out form.
 */

export const menuButtonProps = (panelId: string, open: boolean) => ({
  type: "button" as const,
  "aria-expanded": open,
  "aria-controls": panelId,
});

/**
 * The panel the button names. `group` is the role a named box of controls carries: a plain `div`
 * takes no accessible name at all, and axe counts `aria-label` on one as a serious fault.
 */
export const menuPanelProps = (panelId: string, label: string) => ({
  id: panelId,
  role: "group" as const,
  "aria-label": label,
});

/**
 * What the overflow button adds to its own name when the current section is one of the sections
 * inside it, so a screen reader is told which section is current even though no pill shows it.
 */
export const currentNote = (label: string | null): string | null =>
  label === null ? null : `, current section: ${label}`;

/**
 * The controls a Tab cycles round inside a menu, so focus never leaves it while it is open. The
 * same list as the create-new modal's, kept here so the shared chrome owns its own.
 */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

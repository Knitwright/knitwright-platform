/**
 * The accessible names and states of the create-new modal (spec F-S4, decision 0074): a button that
 * says it opens a dialog and whether that dialog is open, and a modal dialog labelled by its own
 * heading. Kept apart from the component so the attributes are tested alone, as the "Why?" popover's
 * are (components/rulebook/a11y.ts).
 */
export type ModalIds = Readonly<{ dialogId: string; titleId: string }>;

export const newButtonProps = (ids: ModalIds, open: boolean) => ({
  type: "button" as const,
  "aria-haspopup": "dialog" as const,
  "aria-expanded": open,
  "aria-controls": ids.dialogId,
});

export const modalProps = (ids: ModalIds) => ({
  id: ids.dialogId,
  role: "dialog" as const,
  "aria-modal": true,
  "aria-labelledby": ids.titleId,
});

/** The controls a Tab cycles round inside the dialog, so focus never leaves it while it is open. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where a link on the studio home goes (plan v5 Y1, decision 0074). A section the platform has not
 * built yet is never a dead link: it carries `later`, and the screen says so in one sentence.
 */

/** The one sentence shown wherever a section is not built yet. */
export const COMING_LATER = "Coming in a later release";

export type Target =
  /** A page of the app. */
  | Readonly<{ kind: "page"; href: string }>
  /** Opens the create-new modal, which lists the ways into a new design. */
  | Readonly<{ kind: "new-design" }>
  /** An address outside the app, such as the help mailbox. */
  | Readonly<{ kind: "external"; href: string }>
  /** Nothing to open yet. */
  | Readonly<{ kind: "later" }>;

export const page = (href: string): Target => ({ kind: "page", href });
export const external = (href: string): Target => ({ kind: "external", href });
export const newDesign: Target = { kind: "new-design" };
export const later: Target = { kind: "later" };

/** True where the target has no page behind it yet, so the screen shows COMING_LATER instead. */
export const isLater = (target: Target): boolean => target.kind === "later";

/** The address of a target, or null where there is nothing to open. */
export const hrefOf = (target: Target): string | null =>
  target.kind === "page" || target.kind === "external" ? target.href : null;

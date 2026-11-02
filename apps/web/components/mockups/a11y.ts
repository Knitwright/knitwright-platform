/**
 * The accessible names and states of the mockup studio's three panels, kept apart from the
 * components so they are tested on their own (the pattern `components/inspiration/a11y.ts` sets).
 *
 * Two rules decide everything here. A control says what pressing it **does**, not what it is
 * labelled, because a card's visible words are its title and a screen reader would otherwise read
 * "Flat lay on white" twice. And a thing that is turned on or off says so with `aria-pressed`, so a
 * person who cannot see the ring round a chosen filter still knows which one is chosen.
 */

/** A panel: a labelled region, busy while the shell is saving or running something. */
export const panelProps = (headingId: string, busy: boolean) => ({
  role: "region" as const,
  "aria-labelledby": headingId,
  "aria-busy": busy,
});

/** One shelf of the library: a group of `07`, named by its own heading. */
export const collectionProps = (headingId: string) => ({ role: "group" as const, "aria-labelledby": headingId });

/** A list of scenes or photographs: one list, so a screen reader counts them. */
export const listProps = (label: string) => ({ role: "list" as const, "aria-label": label });

/** The button that puts a scene on the canvas. */
export const useSceneProps = (title: string, disabled: boolean) => ({
  type: "button" as const,
  "aria-label": `Use the ${title} scene`,
  disabled,
});

/** One filter chip, which says whether it is the one chosen. */
export const filterProps = (group: string, label: string, chosen: boolean) => ({
  type: "button" as const,
  "aria-label": chosen ? `Clear the ${group} filter ${label}` : `Filter by ${group}: ${label}`,
  "aria-pressed": chosen,
});

/** The Show all / Show fewer button of one shelf. */
export const showAllProps = (group: string, open: boolean, hidden: number) => ({
  type: "button" as const,
  "aria-label": open ? `Show fewer ${group} scenes` : `Show all ${hidden} more ${group} scenes`,
  "aria-expanded": open,
});

/** The crown the spec puts on an item that costs credits. */
export const premiumProps = (title: string) => ({ title, "aria-hidden": false });

/** The loading line, which a screen reader is told about without taking the focus. */
export const busyProps = () => ({ role: "status" as const, "aria-live": "polite" as const });

/** A refusal or a gap: said at once, because the person has just acted. */
export const alertProps = () => ({ role: "alert" as const });

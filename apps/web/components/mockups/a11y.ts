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

/**
 * The button that puts a scene on the canvas.
 *
 * **No `aria-label`.** Its visible words are "Use this scene", and an `aria-label` naming the scene
 * instead would replace them with words the button does not show -- which axe reports as
 * `label-content-name-mismatch`, and which leaves somebody using voice control asking for a button
 * whose name they cannot see. The scene's own title is added inside the button, for a screen reader
 * only, so the accessible name begins with the words on the screen and then says which scene.
 */
export const useSceneProps = (title: string, disabled: boolean) => ({
  type: "button" as const,
  title: `Use the ${title} scene`,
  disabled,
});

/** What a screen reader hears after the visible words of a Use this scene button. */
export const sceneSuffix = (title: string): string => `: ${title}`;

/**
 * One filter chip, which says whether it is the one chosen.
 *
 * `aria-pressed` carries the state, so the ring is not the only sign of it, and the name comes from
 * the chip's own words for the same reason `useSceneProps` has no `aria-label`. The hint about what
 * pressing it again does is a `title`, which replaces nothing.
 */
export const filterProps = (group: string, label: string, chosen: boolean) => ({
  type: "button" as const,
  title: chosen ? `Clear the ${group} filter ${label}` : `Filter by ${group}: ${label}`,
  "aria-pressed": chosen,
});

/** What a screen reader hears after a filter chip's own words: how many, and of what. */
export const filterSuffix = (group: string, count: number): string => `, ${count} ${count === 1 ? "scene" : "scenes"}, ${group} filter`;

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

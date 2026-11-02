/**
 * The accessible names and states of the shoot studio's two panels, kept apart from the components
 * so they are tested on their own (the pattern `components/mockups/a11y.ts` and
 * `components/inspiration/a11y.ts` set).
 *
 * Two rules decide everything here. A control says what pressing it **does**, not what it is
 * labelled, because a card's visible words are its title and a screen reader would otherwise read
 * it twice. And anything that is turned on or off says so with `aria-pressed`, so a person who
 * cannot see the ring round a chosen chip still knows which one is chosen.
 */

/** A panel: a labelled region, busy while the shell is saving or running something. */
export const panelProps = (headingId: string, busy: boolean) => ({
  role: "region" as const,
  "aria-labelledby": headingId,
  "aria-busy": busy,
});

/** One shelf of the ideas library, named by its own heading. */
export const groupProps = (headingId: string) => ({ role: "group" as const, "aria-labelledby": headingId });

/** A list of ideas, presets or results: one list, so a screen reader counts them. */
export const listProps = (label: string) => ({ role: "list" as const, "aria-label": label });

/**
 * The button that starts a shoot from an idea.
 *
 * **No `aria-label`.** Its visible words are "Use this shoot idea", and an `aria-label` naming the
 * idea instead would replace them with words the button does not show -- which axe reports as
 * `label-content-name-mismatch`. The idea's own title is added inside the button for a screen reader
 * only, so the accessible name begins with the words on the screen and then says which idea.
 */
export const useIdeaProps = (title: string, disabled: boolean) => ({
  type: "button" as const,
  title: `Use the ${title} shoot idea`,
  disabled,
});

/** One filter or option chip, which says whether it is the one chosen. */
export const chipProps = (group: string, label: string, chosen: boolean) => ({
  type: "button" as const,
  title: chosen ? `Clear the ${group} ${label}` : `Choose ${group}: ${label}`,
  "aria-pressed": chosen,
});

/** What a screen reader hears after a filter chip's own words: how many, and of what. */
export const filterSuffix = (group: string, count: number): string =>
  `, ${count} ${count === 1 ? "shoot idea" : "shoot ideas"}, ${group} filter`;

/**
 * A model preset card. A preset with no licence on file is `aria-disabled` rather than removed, so
 * a person can see what the library will hold and read why it cannot be used yet.
 */
export const presetProps = (usable: boolean, chosen: boolean) => ({
  type: "button" as const,
  "aria-pressed": chosen,
  "aria-disabled": !usable,
  disabled: !usable,
});

/** The Generate button. The cost is in its visible words, so nothing replaces them. */
export const generateProps = (disabled: boolean, reasonId: string | null) => ({
  type: "submit" as const,
  disabled,
  ...(reasonId === null ? {} : { "aria-describedby": reasonId }),
});

/** The progress bar, which reads the same number it draws. */
export const progressProps = (percent: number, label: string) => ({
  role: "progressbar" as const,
  "aria-valuemin": 0,
  "aria-valuemax": 100,
  "aria-valuenow": percent,
  "aria-valuetext": label,
});

/** The waiting line, which a screen reader is told about without taking the focus. */
export const busyProps = () => ({ role: "status" as const, "aria-live": "polite" as const });

/** A refusal or a gap: said at once, because the person has just acted. */
export const alertProps = () => ({ role: "alert" as const });

/** The consent tick, which is a statement to agree to and not a label to skim. */
export const consentProps = (id: string, checked: boolean) => ({
  type: "checkbox" as const,
  id,
  checked,
  "aria-describedby": `${id}-statement`,
});

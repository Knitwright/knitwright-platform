/**
 * The accessible names and states of the Ask box and the best-practice card, kept apart from the components so
 * the attributes can be tested on their own, as `components/rulebook/a11y.ts` does for the "Why?" popover.
 *
 * An answer arrives after the page has rendered, so the place it lands is a live region: a screen reader reads
 * the answer when it comes without the focus moving off the question box.
 */

export const ASK_HEADING_ID = "ask-rulebook-heading";

export const askBoxProps = (pending: boolean) => ({
  headingId: ASK_HEADING_ID,
  answerProps: {
    role: "status" as const,
    "aria-live": "polite" as const,
    "aria-busy": pending,
    "data-testid": "ask-result",
  },
});

/** The card is a region named after the part it is about, so it is reachable and says what it belongs to. */
export const bestPracticeProps = (part: string, label: string) => ({
  role: "group" as const,
  "aria-label": `Best practice: ${label}`,
  "data-testid": `best-practice-${part}`,
});

export const BEST_PRACTICE_HEADING_ID = "best-practice-heading";

/**
 * The best-practice picker. The card arrives after the page has rendered, as an Ask answer does, so it lands in
 * a live region and the chosen part is announced by the card's own name rather than by a state on a button: a
 * submit button is not a toggle, and `aria-pressed` on one would say something untrue about what pressing does.
 */
export const bestPracticePickerProps = (pending: boolean) => ({
  headingId: BEST_PRACTICE_HEADING_ID,
  groupProps: { role: "group" as const, "aria-labelledby": BEST_PRACTICE_HEADING_ID },
  cardProps: {
    role: "status" as const,
    "aria-live": "polite" as const,
    "aria-busy": pending,
    "data-testid": "best-practice-result",
  },
});

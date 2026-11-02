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

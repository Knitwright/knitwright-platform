/**
 * The accessible names and states of a "Why?" popover: a button that says what it opens and whether it is open, and a
 * non-modal dialog labelled by the rule's heading. Kept apart from the component so the attributes are tested alone.
 */
export type WhyIds = Readonly<{ ruleId: string; panelId: string; headingId: string }>;

export const whyButtonProps = (ids: WhyIds, open: boolean) => ({
  type: "button" as const,
  "aria-label": `Why? Rulebook ${ids.ruleId}`,
  "aria-haspopup": "dialog" as const,
  "aria-expanded": open,
  "aria-controls": ids.panelId,
});

export const whyPanelProps = (ids: WhyIds, busy: boolean) => ({
  id: ids.panelId,
  role: "dialog" as const,
  "aria-modal": false,
  "aria-labelledby": ids.headingId,
  "aria-busy": busy,
  tabIndex: -1,
});

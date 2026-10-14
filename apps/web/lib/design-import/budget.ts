/** The most one import may spend: 3 vision calls and 2 image edits (plan W7d). A counter, not a promise of cost. */
export const MAX_VISION_CALLS = 3;
export const MAX_IMAGE_EDITS = 2;

export interface Spend {
  readonly visionCalls: number;
  readonly imageEdits: number;
}

export interface Budget {
  /** True and counted when a vision call is still allowed; false and not counted otherwise. */
  takeVision(): boolean;
  takeEdit(): boolean;
  spent(): Spend;
}

export function createBudget(limits: Spend = { visionCalls: MAX_VISION_CALLS, imageEdits: MAX_IMAGE_EDITS }): Budget {
  let vision = 0;
  let edits = 0;
  return {
    takeVision: () => (vision < limits.visionCalls ? ((vision += 1), true) : false),
    takeEdit: () => (edits < limits.imageEdits ? ((edits += 1), true) : false),
    spent: () => ({ visionCalls: vision, imageEdits: edits }),
  };
}

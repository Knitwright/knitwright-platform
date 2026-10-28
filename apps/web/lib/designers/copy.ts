/** The words the designer screens use. Plain words; nothing says a design is checked or approved (lib/techpack/wording.test.ts). */

export const SUBMISSION_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const STATUS_LABELS: Readonly<Record<SubmissionStatus, string>> = {
  draft: "Draft, not sent yet",
  submitted: "Waiting for Knitwright to review",
  approved: "Live in the template library",
  rejected: "Not accepted",
};

export const PAYOUT_STATES = ["not_paid", "on_hold", "paid"] as const;
export type PayoutState = (typeof PAYOUT_STATES)[number];

export const PAYOUT_LABELS: Readonly<Record<PayoutState, string>> = {
  not_paid: "Not paid",
  on_hold: "On hold",
  paid: "Marked as paid by Knitwright",
};

export const RIGHTS_STATEMENT = "I hold the rights to every artwork in this design, and I am allowed to offer it as a template.";

export const RATE_NOT_SET =
  "No royalty rate is set yet, so nothing accrues. Units ordered are still counted, and a rate set later does not apply to them.";

export const NO_PAYMENTS =
  "Knitwright does not pay royalties through this screen. The payout state is a note the Knitwright team keeps by hand.";

export const PRIVACY_NOTE = "You see how many units were ordered. You never see who ordered them or any names on a team list.";

export const NOT_REVIEWED_BY_FACTORY = "not reviewed by a factory";

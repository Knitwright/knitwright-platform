import { STATUS_LABELS, type OrderStatus } from "../status";

/**
 * Customer status emails (spec F-O4, "courier booking and tracking stored, with an email to the customer";
 * plan v5 O1, decision 0100).
 *
 * The sender is the same interface the share invites use (`lib/share/email.ts`), so there is one email seam in
 * the platform and one Resend adapter. **Without a provider and its key nothing is sent at all**: the record
 * says so and ops is shown the words to send by hand, exactly as a share invite behaves today.
 *
 * **No message ever states a delivery date.** The days for QC and the freight days are both unset (decision
 * 0071), so each message names what is missing instead. Nothing here promises a date, a time or a defect rate.
 */

export const EMAIL_KINDS = ["batched", "received", "in_production", "ready", "shipped", "delayed", "qc_failed"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const EMAIL_KIND_LABELS: Readonly<Record<EmailKind, string>> = {
  batched: "In a batch",
  received: "Received by the factory",
  in_production: "In production",
  ready: "Ready at the factory",
  shipped: "Sent",
  delayed: "A later date",
  qc_failed: "Being made again",
};

export const NO_DATE_LINE = "We are not giving you a delivery date yet: the days for quality checks and the days in transit are not agreed, so any date would be a guess.";

/** The kind that matches a status, so the screen offers the right message without anyone choosing from a list. */
export const kindForStatus = (status: OrderStatus): EmailKind | null =>
  status === "batched" || status === "received" || status === "in_production" || status === "ready" ? status : null;

export interface StatusWords {
  readonly kind: EmailKind;
  readonly orderRef: string;
  readonly brandName: string;
  readonly status: OrderStatus;
  /** For "shipped": the courier, the number and the tracking page, when there is one. */
  readonly parcel?: Readonly<{ courier: string; trackingNumber: string; trackingUrl: string | null }>;
  /** For "delayed": the new promised date and the reason, both as recorded. */
  readonly delay?: Readonly<{ promisedOn: string; reason: string }>;
}

export interface StatusMessage {
  readonly subject: string;
  /** Plain text. No pictures, no tracking pixel, and the only link is the courier's own tracking page. */
  readonly body: string;
}

const BODY: Readonly<Record<EmailKind, (words: StatusWords) => readonly string[]>> = {
  batched: () => ["Your order is in this week's batch at the factory.", NO_DATE_LINE],
  received: () => ["The factory has your order and the files for it.", NO_DATE_LINE],
  in_production: () => ["Your order is being made.", NO_DATE_LINE],
  ready: () => ["Your order is made and is waiting for its quality check before it is sent.", NO_DATE_LINE],
  shipped: (words) =>
    words.parcel
      ? [
          `Your order has been sent with ${words.parcel.courier}.`,
          `Tracking number: ${words.parcel.trackingNumber}`,
          ...(words.parcel.trackingUrl ? [`Track it here: ${words.parcel.trackingUrl}`] : ["We have no tracking page on file for this courier, so use the number above on their own website."]),
        ]
      : ["Your order has been sent."],
  delayed: (words) =>
    words.delay
      ? [`The date we are working to for your order has moved to ${words.delay.promisedOn}.`, `Why: ${words.delay.reason}`]
      : ["The date we are working to for your order has moved."],
  qc_failed: () => [
    "Your order did not get through its quality check, so the pieces that failed are being made again.",
    "Nothing is sent to you until an inspection is a pass.",
    NO_DATE_LINE,
  ],
};

/** The words of one status message. Pure: the same order and status always give the same message. */
export function statusMessage(words: StatusWords): StatusMessage {
  const lines = [
    `Your Knitwright order ${words.orderRef} (${words.brandName}).`,
    "",
    ...BODY[words.kind](words),
    "",
    `Where it is now: ${STATUS_LABELS[words.status]}.`,
    "",
    "You were sent this because you have an order being made. Reply to this message if anything looks wrong.",
  ];
  return { subject: `${words.orderRef}: ${EMAIL_KIND_LABELS[words.kind]}`, body: lines.join("\n") };
}

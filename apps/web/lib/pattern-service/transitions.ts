/** The life of a pattern service request (decision 0060). The database holds the same table; the integration test keeps the two equal. */
export const STATUSES = ["requested", "accepted", "in_progress", "delivered", "declined"] as const;
export type PatternRequestStatus = (typeof STATUSES)[number];

const NEXT: Readonly<Record<PatternRequestStatus, readonly PatternRequestStatus[]>> = {
  requested: ["accepted", "declined"],
  accepted: ["in_progress", "declined"],
  in_progress: ["delivered", "declined"],
  delivered: [],
  declined: [],
};

export const STATUS_WORDS: Readonly<Record<PatternRequestStatus, string>> = {
  requested: "Requested",
  accepted: "Accepted by the Sialkot team",
  in_progress: "Being drafted",
  delivered: "Delivered",
  declined: "Declined",
};

export const nextStatuses = (from: PatternRequestStatus): readonly PatternRequestStatus[] => NEXT[from];

export const canMove = (from: PatternRequestStatus, to: PatternRequestStatus): boolean => NEXT[from].includes(to);

/** True while the team can still do something with the request. */
export const isOpen = (status: PatternRequestStatus): boolean => NEXT[status].length > 0;

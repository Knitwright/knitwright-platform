export const STRIKE_OFF_STATUSES = ["requested", "received", "accepted", "rejected"] as const;
export type StrikeOffStatus = (typeof STRIKE_OFF_STATUSES)[number];

export const SIGN_OFF_ROLES = ["pattern", "print", "production", "club"] as const;
export type SignOffRole = (typeof SIGN_OFF_ROLES)[number];

export interface ColourNote {
  /** The colour as the colour standard names it, such as "C1". */
  readonly colour: string;
  readonly note: string;
}

export interface StrikeOff {
  readonly id: string;
  readonly releaseId: string;
  readonly status: StrikeOffStatus;
  readonly requestedNote: string;
  readonly requestedAt: string;
  readonly receivedAt: string | null;
  /** Measured on the strike-off, in percent. Null until someone measures. */
  readonly shrinkLengthPct: number | null;
  readonly shrinkWidthPct: number | null;
  readonly colourNotes: readonly ColourNote[];
  readonly photoFileIds: readonly string[];
  readonly decidedByName: string | null;
  readonly decidedRole: string | null;
  readonly decidedOn: string | null;
  readonly decisionNote: string;
}

export interface SignOff {
  readonly id: string;
  readonly releaseId: string;
  readonly role: SignOffRole;
  readonly signerName: string;
  readonly signedOn: string;
  readonly note: string;
  readonly createdAt: string;
}

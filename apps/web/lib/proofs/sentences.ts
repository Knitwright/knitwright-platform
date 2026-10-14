import { SIGN_OFF_ROLES, type SignOff, type SignOffRole, type StrikeOff } from "./types";

export const ROLE_LABELS: Readonly<Record<SignOffRole, string>> = {
  pattern: "Pattern",
  print: "Print",
  production: "Production",
  club: "Club",
};

/** A sign-off in the one form the app uses: who signed, and when. */
export const signOffSentence = (signOff: Pick<SignOff, "role" | "signerName" | "signedOn">): string =>
  `${ROLE_LABELS[signOff.role]} signed by ${signOff.signerName} on ${signOff.signedOn}.`;

export interface RoleLine {
  readonly role: SignOffRole;
  readonly label: string;
  /** The newest sign-off for the role, or null. */
  readonly signOff: SignOff | null;
  readonly sentence: string;
}

/** One line for each role, in a fixed order, so a missing signature is as plain as a present one. */
export function signOffLines(signOffs: readonly SignOff[]): readonly RoleLine[] {
  return SIGN_OFF_ROLES.map((role) => {
    const latest = signOffs
      .filter((s) => s.role === role)
      .reduce<SignOff | null>((best, s) => (best === null || s.createdAt > best.createdAt ? s : best), null);
    return { role, label: ROLE_LABELS[role], signOff: latest, sentence: latest ? signOffSentence(latest) : `${ROLE_LABELS[role]}: not signed yet.` };
  });
}

/** Where a strike-off stands, in one sentence. */
export function strikeOffSentence(s: StrikeOff): string {
  switch (s.status) {
    case "requested":
      return "Asked for. Waiting for the test print to arrive.";
    case "received":
      return "The test print has arrived. Nobody has accepted or rejected it yet.";
    case "accepted":
      return `Accepted by ${s.decidedByName ?? "no name"} (${s.decidedRole ?? "no role"}) on ${s.decidedOn ?? "no date"}.`;
    case "rejected":
      return `Rejected by ${s.decidedByName ?? "no name"} (${s.decidedRole ?? "no role"}) on ${s.decidedOn ?? "no date"}.`;
  }
}

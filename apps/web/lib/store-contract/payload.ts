import { TOKEN_HEADER, TOKEN_LIFETIME_SECONDS } from "./token";
import { CONTRACT_DOCUMENT, PAYLOAD_KINDS, PAYLOAD_PATHS, STORE_CONTRACT_VERSION, type PayloadKind } from "./version";

/**
 * The envelope every endpoint answers with, and the manifest that describes the rest (plan v5 O2).
 *
 * The envelope exists so a reader can tell what it is holding without looking inside: which payload
 * it asked for, which version of the contract answered, where the field-by-field document is, and
 * when the answer was made. A Store that finds a `contractVersion` it does not know can stop before
 * it reads a field that has changed meaning under it.
 */

export interface Envelope<K extends PayloadKind, T> {
  readonly kind: K;
  readonly contractVersion: typeof STORE_CONTRACT_VERSION;
  /** Where every field below is written down, with what a missing one means. */
  readonly document: typeof CONTRACT_DOCUMENT;
  readonly generatedAt: string;
  readonly data: T;
}

export const envelope = <K extends PayloadKind, T>(kind: K, data: T, generatedAt: Date): Envelope<K, T> => ({
  kind,
  contractVersion: STORE_CONTRACT_VERSION,
  document: CONTRACT_DOCUMENT,
  generatedAt: generatedAt.toISOString(),
  data,
});

/** How a field that could be absent is shaped, said once so the document and the manifest agree. */
export const GAP_RULE = {
  held: 'A field the platform holds reads { "status": "held", ... }.',
  gap: 'A field it does not reads { "status": "gap", "missing": [...], "because": "...", "ruleId": "..." } and carries no value of any kind, not even a null one.',
  why: "A null in place of a figure is read as a figure: a null delivery date renders as today and a null price renders as free. So there is never a null here.",
} as const;

/** Said once, plainly, because another product is written against this. */
export const NOT_IN_THIS_CONTRACT =
  "Knitwright holds no cart, no till, no provider, no shop front and no takings. Nothing in this contract names one, and nothing here can be used to take money. The one hand-off to production is submit_order_for_production inside Knitwright.";

export interface Manifest {
  readonly endpoints: readonly Readonly<{ kind: PayloadKind; path: string }>[];
  readonly token: Readonly<{ header: string; lifetimeSeconds: number; signsOver: string }>;
  readonly gaps: typeof GAP_RULE;
  readonly notInThisContract: typeof NOT_IN_THIS_CONTRACT;
}

export const manifest = (): Manifest => ({
  endpoints: PAYLOAD_KINDS.map((kind) => ({ kind, path: PAYLOAD_PATHS[kind] })),
  token: {
    header: TOKEN_HEADER,
    lifetimeSeconds: TOKEN_LIFETIME_SECONDS,
    signsOver: "v1.<payload kind>.<expiry in seconds>.<digest of the canonical query>",
  },
  gaps: GAP_RULE,
  notInThisContract: NOT_IN_THIS_CONTRACT,
});

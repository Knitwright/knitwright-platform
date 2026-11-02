import { CONTRACT_DOCUMENT, type PayloadKind } from "./version";
import { canonicalQuery, SECRET_MIN_LENGTH, TOKEN_HEADER, verifyStoreToken } from "./token";

/**
 * The one door onto every Store endpoint (plan v5 O2).
 *
 * There is no session here. These endpoints answer a service, and a member's browser is not that
 * service: nothing a signed-in person can send opens one, because the only thing that opens one is
 * a signature over the secret, and no browser holds the secret. The endpoints read across brands,
 * which no session may do, and the rows behind them stay under row security either way: the
 * handlers read with the server's own key, and a member's own client sees only their brand's rows
 * (`tests/integration/store-contract.test.ts` proves that half).
 *
 * Without the secret set the endpoint is **switched off** — 503, nothing read — rather than open to
 * anyone. That is the choice decision 0100 made for the weekly cut, for the same reason: an open
 * read of every brand's products is worse than an endpoint that answers nothing. The secret is set
 * in no environment where tests run.
 *
 * A refusal says the same sentence however it failed: which header to send, which payload kind to
 * sign, and that the query is signed in its canonical form. A caller learns what to fix and nothing
 * about which half of their token was wrong.
 */

export type Admission = Readonly<{ ok: true }> | Readonly<{ ok: false; status: number; reason: string }>;

export const SECRET_MISSING = `This endpoint is switched off: STORE_SERVICE_TOKEN is not set on this deploy, or is shorter than ${SECRET_MIN_LENGTH} characters. Nothing was read.`;

export const howToSign = (payload: PayloadKind): string =>
  `Send a token in the "${TOKEN_HEADER}" header, signed over "${payload}" and this call's query in its canonical form (keys sorted, empty values left out). ${CONTRACT_DOCUMENT} has the whole rule.`;

export interface AdmitInput {
  readonly header: string | null;
  readonly secret: string | undefined;
  readonly payload: PayloadKind;
  /** The query as the handler parsed it, which is what the caller signs. */
  readonly query: Readonly<Record<string, string | undefined>>;
  readonly nowSeconds: number;
}

export function admitStoreCall(input: AdmitInput): Admission {
  const secret = input.secret?.trim() ?? "";
  if (secret.length < SECRET_MIN_LENGTH) return { ok: false, status: 503, reason: SECRET_MISSING };
  const token = (input.header ?? "").replace(/^Bearer /i, "").trim();
  if (!verifyStoreToken(secret, token, input.payload, canonicalQuery(input.query), input.nowSeconds)) {
    return { ok: false, status: 404, reason: howToSign(input.payload) };
  }
  return { ok: true };
}

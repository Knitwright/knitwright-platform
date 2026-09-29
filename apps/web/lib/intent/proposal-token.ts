import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { specActionSchema, type SpecAction } from "@/lib/garment";

/**
 * A change the assistant proposed, carried to the browser and back without being stored.
 * The server signs it, so the browser can choose it but not alter it: the source each
 * value names ("ai-suggested", "read-from-image") is the server's, never the browser's.
 * A proposal is tied to one design, brand, person and version, and runs out after an hour.
 */

export const PROPOSAL_TTL_SECONDS = 60 * 60;
/** Room for a change of type followed by a full batch. */
const MAX_PROPOSAL_ACTIONS = 30;
const MAX_TOKEN_LENGTH = 64_000;

export interface Proposal {
  readonly projectId: string;
  readonly brandId: string;
  readonly userId: string;
  /** The version the proposal was made against. It applies only while the design is still at it. */
  readonly version: number;
  readonly actions: readonly SpecAction[];
  /** Who proposed it: the assistant from a message, or a reading of a picture. */
  readonly source: "assistant" | "picture";
  /** One sentence for each difference the changes make, for the version note. */
  readonly explanations: readonly string[];
}

const payloadSchema = z.strictObject({
  projectId: z.string(),
  brandId: z.string(),
  userId: z.string(),
  version: z.number().int().min(1),
  actions: z.array(specActionSchema).min(1).max(MAX_PROPOSAL_ACTIONS),
  source: z.enum(["assistant", "picture"]),
  explanations: z.array(z.string().max(400)).max(MAX_PROPOSAL_ACTIONS * 2),
  expires: z.number().int(),
});

const EXPIRED = "That suggestion has expired. Ask again. Nothing was changed.";
const INVALID = "That suggestion could not be checked. Ask again. Nothing was changed.";

/** A signing key of its own, derived from a server secret, so the secret itself is never used to sign. */
export const proposalKey = (secret: string): Buffer => createHmac("sha256", secret).update("knitwright proposal signing v1").digest();

const mac = (key: Buffer, payload: string): Buffer => createHmac("sha256", key).update(payload).digest();

export function signProposal(proposal: Proposal, key: Buffer, nowSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...proposal, expires: nowSeconds + PROPOSAL_TTL_SECONDS })).toString("base64url");
  return `${payload}.${mac(key, payload).toString("base64url")}`;
}

export type Verified = { readonly ok: true; readonly proposal: Proposal } | { readonly ok: false; readonly reason: string };

export function verifyProposal(
  token: string,
  key: Buffer,
  who: Pick<Proposal, "projectId" | "brandId" | "userId">,
  nowSeconds: number,
): Verified {
  const parts = token.length <= MAX_TOKEN_LENGTH ? token.split(".") : [];
  if (parts.length !== 2) return { ok: false, reason: INVALID };
  const [payload, signature] = parts;
  const expected = mac(key, payload);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: INVALID };
  let parsed: z.ZodSafeParseResult<z.output<typeof payloadSchema>>;
  try {
    parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return { ok: false, reason: INVALID };
  }
  if (!parsed.success) return { ok: false, reason: INVALID };
  const { expires, ...proposal } = parsed.data;
  if (proposal.projectId !== who.projectId || proposal.brandId !== who.brandId || proposal.userId !== who.userId) {
    return { ok: false, reason: INVALID };
  }
  if (expires < nowSeconds) return { ok: false, reason: EXPIRED };
  return { ok: true, proposal };
}

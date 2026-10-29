import type { SupabaseClient } from "@supabase/supabase-js";
import { packetText, type NotifyOutcome, type PacketNotifier } from "./notify";
import { createPacket, resendPacket } from "./service";
import { packetAddress } from "./token";

/**
 * Making or renewing a factory's link, then telling the factory. The token is made here, shown to ops once in
 * the answer, and handed to the database, which keeps only its hash.
 */

export interface IssueDeps {
  readonly admin: Pick<SupabaseClient, "rpc">;
  readonly siteUrl: string;
  readonly notifier: PacketNotifier;
  readonly newToken: () => string;
}

export interface IssueInput {
  readonly actor: string;
  readonly days: number;
  /** The factory's WhatsApp number, or null to send nothing. */
  readonly whatsapp: string | null;
  /** How the batch is named in the message. */
  readonly batch: string;
  /** The due date in the message, or "Not set". */
  readonly due: string;
}

export interface Issued {
  readonly packetId: string;
  /** Shown once. Only its token's hash is stored. */
  readonly address: string;
  readonly expiresAt: string;
  /** What happened to the message, or null when no number was given. */
  readonly notify: NotifyOutcome | null;
}

/** The earliest promised date among a batch's orders, as the factory sheet gives it, or "Not set". */
export const dueDateOf = (orders: readonly Readonly<{ promisedOn: string | null }>[]): string =>
  orders
    .map((o) => o.promisedOn)
    .filter((d): d is string => d !== null)
    .sort()[0] ?? "Not set";

type Target = Readonly<{ kind: "create"; batchId: string }> | Readonly<{ kind: "resend"; batchId: string; packetId: string }>;

export async function issuePacket(deps: IssueDeps, target: Target, input: IssueInput): Promise<Issued> {
  const token = deps.newToken();
  const made =
    target.kind === "create"
      ? await createPacket(deps.admin, { actor: input.actor, batchId: target.batchId, token, days: input.days })
      : await resendPacket(deps.admin, { actor: input.actor, batchId: target.batchId, packetId: target.packetId, token, days: input.days });
  const address = packetAddress(deps.siteUrl, token);
  const notify = input.whatsapp
    ? await deps.notifier.send({ to: input.whatsapp, text: packetText({ address, batch: input.batch, due: input.due, expiresOn: made.expiresAt.slice(0, 10) }) })
    : null;
  return { packetId: made.id, address, expiresAt: made.expiresAt, notify };
}

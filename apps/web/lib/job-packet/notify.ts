/**
 * Telling a factory about its job packet (spec F-O2: "Sialkot factories run on WhatsApp"). A provider is an
 * interface. The stub sends nothing and says so, so ops copies the link by hand. The WhatsApp Business Cloud API
 * adapter exists only when WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are both set, and no test calls it for real.
 */

export interface PacketMessage {
  /** The factory's WhatsApp number in international form, digits only after an optional "+". */
  readonly to: string;
  readonly text: string;
}

export type NotifyOutcome =
  | Readonly<{ sent: true; provider: string }>
  | Readonly<{ sent: false; provider: string; reason: string }>;

export interface PacketNotifier {
  readonly name: string;
  send(message: PacketMessage): Promise<NotifyOutcome>;
}

export const NOT_SET_UP = "WhatsApp is not set up. Copy the link and send it to the factory yourself.";

export const stubNotifier: PacketNotifier = {
  name: "stub",
  send: async () => ({ sent: false, provider: "stub", reason: NOT_SET_UP }),
};

type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "status">>;

const GRAPH_VERSION = "v21.0";
const TIMEOUT_MS = 10_000;

/** The WhatsApp Business Cloud API. A plain text message with the link; the factory's phone shows the address. */
export function whatsappNotifier(config: Readonly<{ token: string; phoneId: string }>, send: Fetch = fetch): PacketNotifier {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(config.phoneId)}/messages`;
  return {
    name: "whatsapp",
    send: async (message) => {
      try {
        const response = await send(url, {
          method: "POST",
          headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: message.to.replace(/^\+/, ""), type: "text", text: { body: message.text, preview_url: false } }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return response.ok
          ? { sent: true, provider: "whatsapp" }
          : { sent: false, provider: "whatsapp", reason: `WhatsApp refused the message (status ${response.status}). Send the link yourself.` };
      } catch {
        return { sent: false, provider: "whatsapp", reason: "WhatsApp could not be reached. Send the link yourself." };
      }
    },
  };
}

export type NotifyEnv = Readonly<Record<string, string | undefined>>;

/** The adapter when both keys are set, otherwise the stub. Read from the process environment by default. */
export function selectNotifier(env: NotifyEnv = process.env, send: Fetch = fetch): PacketNotifier {
  const token = env.WHATSAPP_TOKEN?.trim();
  const phoneId = env.WHATSAPP_PHONE_ID?.trim();
  return token && phoneId ? whatsappNotifier({ token, phoneId }, send) : stubNotifier;
}

/** A factory's WhatsApp number: "+" optional, then 8 to 15 digits. */
export const WHATSAPP_NUMBER = /^\+?[1-9]\d{7,14}$/;

/** The message, in plain words with the link. */
export function packetText(input: Readonly<{ address: string; batch: string; due: string; expiresOn: string }>): string {
  return [
    `Knitwright job packet: ${input.batch}.`,
    `Due date: ${input.due}.`,
    `Open this link for the job sheet, the order list, the sizes, the names and numbers, and the print files: ${input.address}`,
    `Press Received when the files reach you, In production when cutting starts, and Ready for QC when the batch is done. You can add notes and photos on the same page.`,
    `The link works until ${input.expiresOn}. Do not share it outside your factory.`,
  ].join("\n\n");
}

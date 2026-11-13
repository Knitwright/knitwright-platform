/**
 * What the Channels screen says when Shopify's install sends the browser back (`?shopify=`), decision 0155. An
 * unknown value says nothing: the address is not trusted to write on the page.
 */

export type Outcome = Readonly<{ tone: "ok" | "warn"; text: string }>;

const OUTCOMES: Readonly<Record<string, Outcome>> = {
  connected: { tone: "ok", text: "Your Shopify shop is connected. Push a product to start selling it." },
  "not-set-up": { tone: "warn", text: "The Shopify app is not set up on this deploy yet. Nothing was connected." },
  "not-allowed": { tone: "warn", text: "Only owners and admins connect a sales channel. Nothing was connected." },
  "refused-signature": { tone: "warn", text: "Shopify's answer could not be checked, so nothing was connected. Try again." },
  "refused-shop": { tone: "warn", text: "Shopify's answer named no shop, so nothing was connected. Try again." },
  "refused-state": { tone: "warn", text: "That install was started elsewhere or too long ago, so nothing was connected. Start it again here." },
  "refused-person": { tone: "warn", text: "That install was started by someone else, so nothing was connected." },
  taken: { tone: "warn", text: "That shop is connected to another Knitwright account. Disconnect it there first." },
  already: { tone: "warn", text: "This brand already has a Shopify shop connected. Disconnect it first." },
  failed: { tone: "warn", text: "Shopify did not finish the install. Nothing was connected. Try again in a minute." },
};

export const outcomeOf = (value: string | string[] | undefined): Outcome | null => (typeof value === "string" ? (OUTCOMES[value] ?? null) : null);

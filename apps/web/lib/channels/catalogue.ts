/**
 * THE SALES CHANNELS (plan v6 C4, decision 0155; screen 24, prototype `#/store/connect`). Six cards in the order
 * the prototype shows them. Each says honestly what it does today:
 *
 * - Shopify: connect (OAuth), or "Connected · Manage", or "not set up on this deploy" without the Partner app;
 * - Etsy, TikTok Shop and WooCommerce: "Later". Spec F-L6 puts Etsy in Phase 4 and TikTok Shop later; no
 *   WooCommerce plugin exists. Their buttons are disabled with the reason, never a dead link;
 * - Knitwright team store: C2's team stores. Until they have a page this card says so (`TEAM_STORE_HREF`);
 * - API or CSV: product and order CSV export and order CSV import today; a push API is later.
 */

export type ChannelKey = "shopify" | "etsy" | "tiktok" | "team_store" | "woocommerce" | "api_csv";

export type ChannelCard = Readonly<{
  key: ChannelKey;
  name: string;
  /** The two-letter mark on the tile. No logos (decision 0131 item 4). */
  mark: string;
  badge: Readonly<{ label: string; tone: "navy" | "info" | "ok" }> | null;
  lead: string;
  features: readonly string[];
  /** "later": not built; the card says when and why, and nothing opens. */
  availability: "built" | "later";
  /** For a "later" card: why. */
  laterReason?: string;
}>;

/** Where C2's team store builder lives once it is merged. Null: the card says it is on its way. */
export const TEAM_STORE_HREF: string | null = null;

export const CHANNELS: readonly ChannelCard[] = [
  {
    key: "shopify",
    name: "Shopify",
    mark: "S",
    badge: { label: "Recommended", tone: "navy" },
    lead: "Sync products and send orders to Knitwright automatically. Best for clubs and brands with their own shop.",
    features: ["Auto order import", "Live stock and prices", "Tracking sent to buyers"],
    availability: "built",
  },
  {
    key: "etsy",
    name: "Etsy",
    mark: "E",
    badge: null,
    lead: "List kits and teamwear on Etsy. Production-partner disclosure is filled in for you.",
    features: ["Auto order import", "Production partner listed"],
    availability: "later",
    laterReason: "Etsy comes later (spec phase 4). Use Shopify or a CSV today.",
  },
  {
    key: "tiktok",
    name: "TikTok Shop",
    mark: "T",
    badge: { label: "New", tone: "info" },
    lead: "Sell kit drops in videos and lives. UK shop only for now.",
    features: ["Auto order import", "Video-ready mockups"],
    availability: "later",
    laterReason: "TikTok Shop comes later. Use Shopify or a CSV today.",
  },
  {
    key: "team_store",
    name: "Knitwright team store",
    mark: "KW",
    badge: { label: "Free", tone: "ok" },
    lead: "A hosted store for your club. Players pick sizes, names and numbers, pay, and it ships as one batch.",
    features: ["No monthly fee", "Club fundraising margin", "One delivery to the club"],
    availability: TEAM_STORE_HREF === null ? "later" : "built",
    laterReason: "Team stores are on their way to this page.",
  },
  {
    key: "woocommerce",
    name: "WooCommerce",
    mark: "W",
    badge: null,
    lead: "Connect a WordPress shop with the Knitwright plugin.",
    features: ["Auto order import"],
    availability: "later",
    laterReason: "The WooCommerce plugin comes later. Use the CSV import today.",
  },
  {
    key: "api_csv",
    name: "API or CSV",
    mark: "{}",
    badge: null,
    lead: "For custom shops and club systems. Push orders by API or upload a spreadsheet.",
    features: ["CSV export", "CSV import"],
    availability: "built",
  },
];

export const channelCard = (key: ChannelKey): ChannelCard => CHANNELS.find((card) => card.key === key)!;

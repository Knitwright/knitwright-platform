import { cx } from "@/components/ui/cx";
import type { ChannelKey } from "@/lib/channels/catalogue";

/** A channel's tile: its letter on its colour (screen 24). Decorative: the name is always written beside it. */
const FILL: Readonly<Record<ChannelKey, string>> = {
  shopify: "bg-channel-shopify",
  etsy: "bg-channel-etsy",
  tiktok: "bg-channel-tiktok",
  team_store: "bg-navy",
  woocommerce: "bg-channel-woo",
  api_csv: "bg-channel-api",
};

export function ChannelTile({ channel, mark, size = "md" }: Readonly<{ channel: ChannelKey; mark: string; size?: "sm" | "md" }>) {
  return (
    <span
      aria-hidden="true"
      className={cx("grid shrink-0 place-items-center rounded-sm font-bold text-on-dark", FILL[channel], size === "md" ? "size-8.5 text-small" : "size-6 text-caption")}
    >
      {mark}
    </span>
  );
}

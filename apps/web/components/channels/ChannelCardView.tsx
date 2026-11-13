"use client";

import { Check } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { TEAM_STORE_HREF, type ChannelCard } from "@/lib/channels/catalogue";
import type { ShopifyState } from "@/lib/channels/view";
import { ChannelTile } from "./ChannelTile";

/**
 * One channel card (screen 24): tile, name and badge; the lead; the ticked features; one action. A "later" card's
 * button is disabled and says why, so nothing opens onto a page that does not exist.
 */

const BADGE: Readonly<Record<"navy" | "info" | "ok", string>> = {
  navy: "bg-navy text-on-dark",
  info: "bg-info-soft text-link",
  ok: "bg-ok-soft text-ok",
};

export const NOT_SET_UP_REASON = "The Shopify app is not set up on this deploy yet.";
export const CONNECT_ROLE_REASON = "Only owners and admins connect a sales channel.";

type Props = Readonly<{
  card: ChannelCard;
  shopify: ShopifyState;
  canConnect: boolean;
  onConnect: (key: ChannelCard["key"]) => void;
}>;

function Action({ card, shopify, canConnect, onConnect }: Props) {
  if (card.availability === "later") {
    return (
      <Button variant="secondary" size="md" disabledReason={card.laterReason ?? "Later."}>
        Later
      </Button>
    );
  }
  if (card.key === "api_csv") {
    return (
      <a href="#api-csv" className={buttonClasses("primary", false, "no-underline")}>
        Open
      </a>
    );
  }
  // C2's team stores (decision 0153): opened from a design's Order drawer and listed on Team › Stores.
  if (card.key === "team_store" && TEAM_STORE_HREF !== null) {
    return (
      <a href={TEAM_STORE_HREF} className={buttonClasses("primary", false, "no-underline")}>
        Create team store
      </a>
    );
  }
  if (card.key === "shopify" && shopify.state === "connected") {
    return (
      <a href="#shopify-manage" className={buttonClasses("secondary", false, "no-underline")}>
        Connected · Manage
      </a>
    );
  }
  const reason = shopify.state === "not_set_up" ? NOT_SET_UP_REASON : canConnect ? undefined : CONNECT_ROLE_REASON;
  return (
    <Button disabledReason={reason} onClick={() => onConnect(card.key)}>
      Connect<span className="sr-only"> {card.name}</span>
    </Button>
  );
}

export function ChannelCardView(props: Props) {
  const { card } = props;
  return (
    <section id={`channel-${card.key}`} aria-labelledby={`channel-${card.key}-name`} className="flex scroll-mt-24 flex-col gap-4 rounded-xl bg-soft p-5.5">
      <header className="flex items-center gap-3">
        <ChannelTile channel={card.key} mark={card.mark} />
        <h2 id={`channel-${card.key}-name`} className="text-h3 text-text">
          {card.name}
        </h2>
        <span className="ml-auto flex items-center gap-2">
          {card.availability === "later" ? <span className="rounded-full bg-bg px-2.5 py-0.5 text-caption font-semibold text-muted">Later</span> : null}
          {card.badge ? <span className={cx("rounded-full px-2.5 py-0.5 text-caption font-semibold", BADGE[card.badge.tone])}>{card.badge.label}</span> : null}
        </span>
      </header>
      <p className="text-body text-text-2">{card.lead}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {card.features.map((feature) => (
          <li key={feature} className="inline-flex items-center gap-2 text-body text-text-2">
            <Icon icon={Check} size={16} className="text-text" />
            {feature}
          </li>
        ))}
      </ul>
      <div>
        <Action {...props} />
      </div>
    </section>
  );
}

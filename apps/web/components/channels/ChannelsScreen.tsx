"use client";

import { Plug } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { CHANNELS, type ChannelKey } from "@/lib/channels/catalogue";
import type { Outcome } from "@/lib/channels/outcome";
import type { ChannelsPage } from "@/lib/channels/view";
import { ChannelCardView } from "./ChannelCardView";
import { ChannelTile } from "./ChannelTile";
import { ConnectChannelModal } from "./ConnectChannelModal";
import { CsvPanel } from "./CsvPanel";
import { ShopifyPanel } from "./ShopifyPanel";

/**
 * SALES CHANNELS (09 screen 24, prototype p15/p16; plan v6 C4, decision 0155). Self-contained, so C5's Store pages
 * can mount it as their Channels tab: pass `heading={false}` where the tab bar already names the page, and the
 * "Connect a sales channel" button moves into the intro line.
 *
 * Layout: the title with Connect; one line on how it works; channel chips (in-page links to each card); the
 * 2-column grid of cards; then the Shopify manage panel when a shop is connected, and the API or CSV panel.
 */

type Props = Readonly<{ page: ChannelsPage; outcome?: Outcome | null; heading?: boolean }>;

export function ChannelsScreen({ page, outcome = null, heading = true }: Props) {
  const [modal, setModal] = useState<Readonly<{ key: ChannelKey; direct: boolean }> | null>(null);
  const connect = (
    <Button icon={<Icon icon={Plug} size={16} />} onClick={() => setModal({ key: "shopify", direct: false })}>
      Connect a sales channel
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 pb-16">
      {heading ? (
        <header className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <h1 className="text-h1 text-text">Sales channels</h1>
          {connect}
        </header>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body text-muted">Connect where you sell. Orders come to Knitwright, we make them in Sialkot and ship to your buyers.</p>
        {heading ? null : connect}
      </div>
      {outcome ? <Notice tone={outcome.tone} role={outcome.tone === "warn" ? "alert" : "status"}>{outcome.text}</Notice> : null}

      <nav aria-label="Sales channels">
        <ul className="flex flex-wrap gap-2.5">
          {CHANNELS.map((card) => (
            <li key={card.key}>
              <a href={`#channel-${card.key}`} className="inline-flex h-11 items-center gap-2.5 rounded-md border border-border bg-bg px-3.5 text-body font-semibold text-text no-underline hover:bg-soft">
                <ChannelTile channel={card.key} mark={card.mark} size="sm" />
                {card.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-5 lg:grid-cols-2">
        {CHANNELS.map((card) => (
          <ChannelCardView key={card.key} card={card} shopify={page.shopify} canConnect={page.canConnect} onConnect={(key) => setModal({ key, direct: true })} />
        ))}
      </div>

      {page.canList || page.canConnect ? null : <p className="text-body text-muted">Your role can look at the channels but not change them.</p>}
      <ShopifyPanel page={page} />
      <CsvPanel orders={page.orders} canList={page.canList} />

      {modal ? <ConnectChannelModal open initial={modal.key} direct={modal.direct} shopify={page.shopify} canConnect={page.canConnect} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

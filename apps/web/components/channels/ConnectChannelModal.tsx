"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { startShopifyConnectAction } from "@/lib/channels/actions";
import { CHANNELS, type ChannelKey } from "@/lib/channels/catalogue";
import type { ShopifyState } from "@/lib/channels/view";
import { CONNECT_ROLE_REASON, NOT_SET_UP_REASON } from "./ChannelCardView";
import { ChannelTile } from "./ChannelTile";

/**
 * "Connect to a sales channel" (screen 24, prototype p16): radio cards, then Not now / Continue. Continue on Shopify
 * asks for the shop's address and goes to Shopify's install page; on API or CSV it opens that panel. A "later"
 * channel can be picked to read about, but Continue then says why it cannot go on.
 */

type Props = Readonly<{
  open: boolean;
  initial: ChannelKey;
  /** Straight to the shop's address: the Shopify card's own Connect. */
  direct: boolean;
  shopify: ShopifyState;
  canConnect: boolean;
  onClose: () => void;
}>;

function whyNot(key: ChannelKey, shopify: ShopifyState, canConnect: boolean): string | undefined {
  const card = CHANNELS.find((one) => one.key === key)!;
  if (card.availability === "later") return card.laterReason;
  if (key !== "shopify") return undefined;
  if (shopify.state === "connected") return "A Shopify shop is already connected. Manage it below.";
  if (shopify.state === "not_set_up") return NOT_SET_UP_REASON;
  return canConnect ? undefined : CONNECT_ROLE_REASON;
}

function ChannelRadios({ chosen, onChoose }: Readonly<{ chosen: ChannelKey; onChoose: (key: ChannelKey) => void }>) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Sales channel</legend>
      {CHANNELS.map((card) => (
        <label
          key={card.key}
          className={cx(
            "flex cursor-pointer items-start gap-3.5 rounded-xl border bg-soft p-4.5 has-focus-visible:ring-2 has-focus-visible:ring-electric",
            chosen === card.key ? "border-navy" : "border-transparent",
          )}
        >
          <input type="radio" name="channel" value={card.key} checked={chosen === card.key} onChange={() => onChoose(card.key)} className="mt-1.5 size-5 accent-navy" />
          <ChannelTile channel={card.key} mark={card.mark} />
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-3 text-body font-semibold text-text">
              {card.name}
              {card.badge ? <span className="text-caption font-semibold text-text-2">{card.badge.label}</span> : null}
              {card.availability === "later" ? <span className="text-caption font-semibold text-muted">Later</span> : null}
            </span>
            <span className="text-small text-text-2">{card.lead}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function ConnectChannelModal({ open, initial, direct, shopify, canConnect, onClose }: Props) {
  const [chosen, setChosen] = useState<ChannelKey>(initial);
  const [step, setStep] = useState<"pick" | "shop">(direct && initial === "shopify" && !whyNot("shopify", shopify, canConnect) ? "shop" : "pick");
  const [shop, setShop] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const reason = whyNot(chosen, shopify, canConnect);

  const go = () => {
    if (chosen === "api_csv") {
      onClose();
      window.location.hash = "api-csv";
      return;
    }
    setStep("shop");
  };

  const install = () => {
    setProblem(null);
    start(async () => {
      const reply = await startShopifyConnectAction({ shop }).catch(() => null);
      if (!reply) return setProblem("Shopify could not be reached from here. Check your connection and try again.");
      if (!reply.success) return setProblem(reply.error.message);
      window.location.assign(reply.data.url);
    });
  };

  const footer =
    step === "pick" ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          Not now
        </Button>
        <Button disabledReason={reason} onClick={go}>
          Continue
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={() => setStep("pick")}>
          Back
        </Button>
        <Button pending={pending} disabled={shop.trim() === ""} onClick={install}>
          Continue to Shopify
        </Button>
      </>
    );

  return (
    <Modal open={open} onClose={onClose} title="Connect to a sales channel" size="md" footer={footer} dirty={shop !== ""}>
      {step === "pick" ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">Pick where you&apos;ll sell. You can add more later.</p>
          <ChannelRadios chosen={chosen} onChoose={setChosen} />
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            install();
          }}
        >
          <p className="text-body text-muted">Shopify asks you to approve Knitwright on your shop, then sends you back here.</p>
          <Field name="shop" label="Your shop's address" hint="Such as my-club.myshopify.com" value={shop} onChange={(event) => setShop(event.target.value)} autoComplete="off" />
          {problem ? (
            <Notice tone="warn" role="alert">
              {problem}
            </Notice>
          ) : null}
        </form>
      )}
    </Modal>
  );
}

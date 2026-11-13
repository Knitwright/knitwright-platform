import { Plug } from "lucide-react";
import { EmptyState } from "@/components/ui/PageStates";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/LinkButton";

/**
 * The Sales channels tab until the channels workstream (plan v6 C4, decision 0155) fills it: an honest empty state,
 * not a grid of buttons that do nothing. C4 replaces the one line in `ChannelsSlot.tsx`.
 */
export function ChannelsPlaceholder() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-muted">Connect where you sell. Orders come to Knitwright, we make them in Sialkot and ship to your buyers.</p>
      <EmptyState icon={<Icon icon={Plug} size={22} />} title="Sales channels are on their way" action={<LinkButton href="/orders" variant="secondary">See your orders</LinkButton>}>
        Shopify comes first, then Etsy, TikTok Shop, WooCommerce and an API or CSV upload. Until then, orders you place yourself still go to production.
      </EmptyState>
    </div>
  );
}

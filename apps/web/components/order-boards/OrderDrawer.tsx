"use client";

import type { Route } from "next";
import Link from "next/link";
import { useId, useState } from "react";
import { SampleForm } from "@/components/make/SampleForm";
import { SelectSizes } from "@/components/make/SelectSizes";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { whyNoRun } from "@/lib/make/gate";
import { loadOrderDrawerAction } from "@/lib/order-boards/actions";
import { orderGate } from "@/lib/order-boards/canvas";
import type { OrderableDesign } from "@/lib/order-boards/types";
import { PanelFrame } from "./PanelFrame";
import { QuoteTab } from "./QuoteTab";
import { useLoaded } from "./useLoaded";

/**
 * THE ORDER DRAWER (plan v6 E4, decision 0148; `08` §5.7, screen 13, e30): tabs Sample · Run · Team
 * store · Quote PDF for the design of the selected garment board.
 *
 * Sample and Run are the make flow's own forms (`components/make`), so every send runs the same
 * actions, and with them the D1 validation gate, the content screen and the golden-sample rule
 * (`lib/make/actions.ts`): nothing here can order around them. Checkout is not built yet -- it comes
 * with payments (plan v6 C1) -- so the drawer says how an order is paid today instead of drawing a
 * Checkout button that goes nowhere. Team stores come with the Store (wave 5); the tab says so and
 * links to the roster on Team, which exists.
 */

const TABS = [
  { id: "sample", label: "Sample" },
  { id: "run", label: "Run" },
  { id: "store", label: "Team store" },
  { id: "quote", label: "Quote PDF" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export const CHECKOUT_LATER =
  "Card checkout arrives with payments. Today the order is handed to production and Knitwright invoices it outside the platform.";

export function OrderDrawer({ design, onClose }: Readonly<{ design: OrderableDesign; onClose: () => void }>) {
  const idBase = useId();
  const [tab, setTab] = useState<TabId>("sample");
  const gate = orderGate(design);
  const { loaded, retry } = useLoaded(() => loadOrderDrawerAction({ projectId: design.id, market: "GBP" }), design.id);

  return (
    <PanelFrame title={`Order · ${design.name}`} onClose={onClose} width={480} testId="order-drawer">
      <Tabs items={TABS} value={tab} onChange={(id) => setTab(id as TabId)} label="Order" idBase={idBase} variant="pill" />
      <div {...tabPanelProps(idBase, tab)} className="flex flex-col gap-3 outline-none">
        {tab === "store" ? (
          <TeamStoreTab />
        ) : loaded.state === "loading" ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">Reading prices and dates</span>
            <SkeletonText lines={4} />
          </div>
        ) : loaded.state === "error" ? (
          <div className="flex flex-col gap-2">
            <Notice tone="warn" role="alert">
              {loaded.message}
            </Notice>
            <button type="button" onClick={retry} className={buttonClasses("secondary", false, "self-start", "sm")}>
              Try again
            </button>
          </div>
        ) : tab === "quote" ? (
          <QuoteTab articleCode={loaded.data.context.articleCode} designName={design.name} />
        ) : !gate.open ? (
          <Notice tone="warn" role="alert">
            {gate.reason}
          </Notice>
        ) : tab === "sample" ? (
          <SampleForm context={loaded.data.context} canOrder={loaded.data.canOrder} />
        ) : whyNoRun(loaded.data.context.gate) !== null ? (
          <Notice tone="info">{whyNoRun(loaded.data.context.gate)}</Notice>
        ) : (
          <SelectSizes products={loaded.data.products} currency="GBP" canOrder={loaded.data.canOrder} deliveryText={loaded.data.context.delivery.text} />
        )}
      </div>
      {tab === "sample" || tab === "run" ? (
        <p className="text-caption text-muted" data-testid="order-drawer-checkout">
          {CHECKOUT_LATER}
        </p>
      ) : null}
    </PanelFrame>
  );
}

function TeamStoreTab() {
  return (
    <div className="flex flex-col gap-2" data-testid="order-drawer-store">
      <p className="text-body text-text">Team stores open with the Store.</p>
      <p className="text-small text-muted">
        Open and close dates, the club&apos;s margin and a link with a QR code for players arrive when the Store is built. Your roster is already on
        Team, so the store can read it on the day it opens.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={"/team" as Route} className={buttonClasses("secondary", false, "", "sm")}>
          Open the roster
        </Link>
        <Link href={"/store" as Route} className={buttonClasses("ghost", false, "", "sm")}>
          About the Store
        </Link>
      </div>
    </div>
  );
}

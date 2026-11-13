"use client";

import type { Route } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SkeletonText } from "@/components/ui/Skeleton";
import { useLoaded } from "@/components/order-boards/useLoaded";
import type { MakeContext } from "@/lib/make/context";
import { whyNoRun } from "@/lib/make/gate";
import { loadDesignStoresAction } from "@/lib/team-stores/actions";
import { OpenStoreForm } from "./OpenStoreForm";
import { StoreCardView } from "./StoreCardView";

/**
 * THE ORDER DRAWER'S TEAM STORE TAB (screen 13 "Team store: open/close dates, roster, club margin, link + QR"; spec
 * F-T6; plan v6 C2, decision 0153). Opens a store window for this design and lists the stores it already has, each
 * with its link, QR code and state. A design that cannot be made as a run yet says why instead of the form.
 */
export function TeamStoreTab({ projectId, designName, context }: Readonly<{ projectId: string; designName: string; context: MakeContext }>) {
  const { loaded, retry } = useLoaded(() => loadDesignStoresAction({ projectId }), projectId);

  if (loaded.state === "loading") {
    return (
      <div role="status" className="flex flex-col gap-2">
        <span className="sr-only">Reading this design&apos;s team stores</span>
        <SkeletonText lines={4} />
      </div>
    );
  }
  if (loaded.state === "error") {
    return (
      <div className="flex flex-col gap-2">
        <Notice tone="warn" role="alert">
          {loaded.message}
        </Notice>
        <button type="button" onClick={retry} className={buttonClasses("secondary", false, "self-start", "sm")}>
          Try again
        </button>
      </div>
    );
  }

  const { stores, seasons, clubPage, canEdit } = loaded.data;
  const blocked = whyNoRun(context.gate);
  return (
    <div className="flex flex-col gap-4" data-testid="order-drawer-store">
      <p className="text-small text-muted">
        Players and parents buy their own size, name and number from a link or QR code, with no account. When the store closes, every piece becomes one order with one delivery to the club; below the minimum, everyone is refunded.
      </p>
      {stores.length === 0 ? (
        <p className="text-body text-text-2">{designName} has no team store yet.</p>
      ) : (
        stores.map((card) => <StoreCardView key={card.id} card={card} canEdit={canEdit} onChanged={retry} />)
      )}
      {!canEdit ? (
        <p className="text-small text-muted">Your role in this club can look at its stores but not open one.</p>
      ) : blocked !== null ? (
        <Notice tone="info">{blocked} A team store sells a run, so it opens once a run can be ordered.</Notice>
      ) : (
        <OpenStoreForm projectId={projectId} designName={designName} context={context} seasons={seasons} onOpened={retry} />
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-small font-semibold">
        <Link href={"/team?tab=stores" as Route} className="text-link live:hover:underline">
          All team stores
        </Link>
        {clubPage?.published ? (
          <a href={clubPage.address} className="text-link live:hover:underline">
            Club page
          </a>
        ) : (
          <Link href={"/team?tab=stores" as Route} className="text-link live:hover:underline">
            Set up the club page
          </Link>
        )}
      </div>
    </div>
  );
}

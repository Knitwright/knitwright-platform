import type { Route } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/Button";
import { whyNoRun, type RunGate } from "@/lib/make/gate";
import { STORE_HANDS_IT } from "@/lib/make/vocabulary";
import { toolHref } from "@/lib/workspace/tools";

type Props = Readonly<{ projectId: string; gate: RunGate; hasProduct: boolean }>;

const CARD = "flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-5";

/**
 * The four next steps of F-S7, and nothing more. Ordering a sample comes first until a golden sample has been
 * signed off; after that, ordering a run does.
 *
 * "Connect your store & publish" is the Store's, not this platform's (owner decision 1). It is shown so the step
 * is not missing from the page, and it says who does it. Nothing here takes a payment.
 */
export function NextSteps({ projectId, gate, hasProduct }: Props) {
  const blocked = whyNoRun(gate);
  return (
    <section aria-labelledby="make-next" className="flex flex-col gap-4">
      <h2 id="make-next" className="text-base font-semibold text-ink">
        Next steps
      </h2>
      {hasProduct ? null : <Notice>List this design as a product on your brand page first. A sample and a run are ordered against a product.</Notice>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className={CARD}>
          <h3 className="text-[15px] font-medium text-ink">Order a sample</h3>
          <p className="text-sm text-muted">One piece per size, up to three sizes. You see the price and the delivery date before anything is sent.</p>
          <Link href={`/studio/${projectId}/make/sample` as Route} className={buttonClasses(blocked === null ? "secondary" : "primary", false, "self-start")}>
            Order a sample
          </Link>
        </div>

        <div className={CARD}>
          <h3 className="text-[15px] font-medium text-ink">Shoot it</h3>
          <p className="text-sm text-muted">Pictures and video of this design to share, in the design&apos;s own media screen.</p>
          <Link href={toolHref(projectId, "media") as Route} className={buttonClasses("secondary", false, "self-start")}>
            Open Mockups &amp; media
          </Link>
        </div>

        <div className={CARD}>
          <h3 className="text-[15px] font-medium text-ink">Connect your store &amp; publish</h3>
          <p className="text-sm text-muted">{STORE_HANDS_IT}. Selling, storefronts and payment are not part of this platform.</p>
          <span className="text-sm text-faint">Nothing to do here yet.</span>
        </div>

        <div className={CARD}>
          <h3 className="text-[15px] font-medium text-ink">Order a run</h3>
          <p className="text-sm text-muted">{blocked ?? "A golden sample of this version has been signed off, so a run of it can be made."}</p>
          {blocked === null ? (
            <Link href={`/studio/${projectId}/make/order` as Route} className={buttonClasses("primary", false, "self-start")}>
              Select sizes
            </Link>
          ) : (
            <span className={`${buttonClasses("primary", false, "self-start")} pointer-events-none opacity-55`} aria-disabled="true">
              Select sizes
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-muted">
        <Link href="/studio/new" className="soft-link text-cobalt-soft">
          Create more products in this collection
        </Link>
      </p>
    </section>
  );
}

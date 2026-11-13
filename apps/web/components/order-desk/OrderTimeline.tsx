import { Check } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { reachedStep, STEP_LABELS, TRACK_STEPS, type CustomerStatus } from "@/lib/order-desk/status";

/**
 * The tracking timeline (p11): F-T7's seven steps, with "Placed" where checkout's "Paid" will be.
 * Steps reached are ticked, the current one is a filled dot, the rest are grey. An order on hold
 * stops at the first step, and its pill says so.
 */
export function OrderTimeline({ status }: Readonly<{ status: CustomerStatus }>) {
  const reached = reachedStep(status);
  return (
    <ol aria-label="Where this order is" className="grid grid-cols-7 gap-0">
      {TRACK_STEPS.map((step, index) => {
        const done = index < reached || (index === reached && index === TRACK_STEPS.length - 1);
        const current = index === reached;
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center gap-2 text-center">
            {index > 0 ? <span aria-hidden="true" className={cx("absolute top-2.5 right-1/2 h-0.5 w-full", index <= reached ? "bg-ok" : "bg-border")} /> : null}
            <span
              aria-hidden="true"
              className={cx(
                "relative grid size-5 place-items-center rounded-full",
                done ? "bg-ok text-on-dark" : current ? "bg-electric" : "bg-soft-2",
              )}
            >
              {done ? <Icon icon={Check} size={14} /> : null}
            </span>
            <span className={cx("text-small", current ? "font-semibold text-text" : "text-muted")}>
              {STEP_LABELS[step]}
              <span className="sr-only">{done ? ", done" : current ? ", now" : ", not yet"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

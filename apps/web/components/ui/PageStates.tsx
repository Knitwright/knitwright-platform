import { CircleAlert, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { PremiumMark } from "./Marks";
import { PRODUCT } from "@/lib/config/product";
import { openPlans, planIdFromName } from "@/lib/plans/modal-store";

/**
 * The page and data states of docs/spec/10-design-system.md §9. Loading is `SkeletonPage` and
 * friends (Skeleton.tsx). Each state here is a picture in a 64 px `soft` circle, an h3 title,
 * one line of help and one action, centred where the content would be.
 */

type StateFrameProps = Readonly<{
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "bad";
  role?: "status" | "alert";
  className?: string;
}>;

function StateFrame({ icon, title, children, action, tone = "neutral", role, className }: StateFrameProps) {
  return (
    <section role={role} className={cx("mx-auto flex max-w-110 flex-col items-center gap-3 px-4 py-12 text-center", className)}>
      <span className={cx("grid size-16 place-items-center rounded-full", tone === "bad" ? "bg-bad-soft text-bad" : "bg-soft text-text-2")}>
        {icon}
      </span>
      <h3 className="text-h3 text-text">{title}</h3>
      {children ? <div className="text-body text-muted">{children}</div> : null}
      {action ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </section>
  );
}

/** Empty: one primary action, such as "Create your first kit". */
export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: Readonly<{ icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }>) {
  return <StateFrame icon={icon} title={title} action={action} className={className}>{children}</StateFrame>;
}

type ErrorStateProps = Readonly<{
  title?: string;
  /** A plain explanation of what went wrong. */
  children: ReactNode;
  onRetry?: () => void;
  /** Shown with "Contact support" so support can find the request. */
  requestId?: string;
  supportHref?: string;
  className?: string;
}>;

/** Error (page): the Empty layout with a `bad` icon, a plain explanation, Retry, and Contact support with the request ID. */
export function ErrorState({ title = "Something went wrong", children, onRetry, requestId, supportHref = `mailto:${PRODUCT.contactEmail}`, className }: ErrorStateProps) {
  const subject = requestId ? `?subject=${encodeURIComponent(`Request ${requestId}`)}` : "";
  return (
    <StateFrame
      tone="bad"
      role="alert"
      icon={<Icon icon={CircleAlert} size={22} />}
      title={title}
      className={className}
      action={
        <>
          {onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
          <a href={`${supportHref}${subject}`} className="inline-flex h-10 items-center rounded-md px-3 text-body font-semibold text-link hover:underline">
            Contact support
          </a>
        </>
      }
    >
      <p>{children}</p>
      {requestId ? (
        <p className="mt-1 text-caption">
          Request ID <code className="font-mono text-text-2 select-all">{requestId}</code>
        </p>
      ) : null}
    </StateFrame>
  );
}

/** No permission: "Ask the owner for access", the owner named, and Request access. */
export function NoPermission({
  owner,
  onRequest,
  requested = false,
  className,
}: Readonly<{ owner: string; onRequest?: () => void; requested?: boolean; className?: string }>) {
  return (
    <StateFrame
      icon={<Icon icon={Lock} size={22} />}
      title="Ask the owner for access"
      className={className}
      action={
        <Button onClick={onRequest} disabledReason={requested ? `Request sent to ${owner}` : undefined}>
          {requested ? "Request sent" : "Request access"}
        </Button>
      }
    >
      <p>
        This belongs to <span className="font-semibold text-text-2">{owner}</span>. They can give you access.
      </p>
    </StateFrame>
  );
}

/**
 * Premium-gated (§9): the control stays visible with ♛ top right; pressing it opens the plan
 * modal on the plan named. The feature is never hidden. With no `onUpgrade` it opens the shell's
 * plans modal (decision 0144) with that plan ringed.
 */
export function PremiumGate({
  label,
  plan,
  onUpgrade,
  icon,
  className,
}: Readonly<{ label: string; plan: string; onUpgrade?: () => void; icon?: ReactNode; className?: string }>) {
  return (
    <span className={cx("relative inline-flex", className)}>
      <Button variant="secondary" icon={icon} onClick={onUpgrade ?? (() => openPlans({ kind: "plans", plan: planIdFromName(plan) }))} aria-label={`${label}, needs ${plan}`} data-plan={plan}>
        {label}
      </Button>
      <PremiumMark label={`Needs ${plan}`} className="pointer-events-none absolute -top-1.5 -right-1.5 grid size-5 rounded-full bg-bg shadow-e1" />
    </span>
  );
}

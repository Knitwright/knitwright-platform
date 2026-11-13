import type { Route } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/ui/Chips";
import { cx } from "@/components/ui/cx";
import { STOREFRONT_EDITOR_HREF } from "@/lib/store-pages/routes";
import { costLine, type BrandingOption, type StoreSettings } from "@/lib/store-pages/settings";
import { BrandingSetup } from "./BrandingSetup";

/**
 * Branding (09 screen 25, prototype p18): what goes in every parcel, 2 × 2 cards with cost, details and Set up.
 * Costs are rows, labelled placeholders. The storefront's own look comes from the brand kit; its editor is C3's.
 */

const PICTURE: Readonly<Record<string, string>> = {
  packing_inserts: "bg-ink",
  neck_labels: "bg-navy",
  hang_tags: "bg-navy-2",
  gift_messages: "bg-link",
};

function Picture({ option }: Readonly<{ option: BrandingOption }>) {
  return (
    <div aria-hidden className={cx("grid h-50 place-items-center rounded-lg", PICTURE[option.id] ?? "bg-navy")}>
      <span className="rounded-md bg-bg px-4 py-2 text-small font-bold text-navy">{option.name}</span>
    </div>
  );
}

export function StorefrontLook() {
  const href: Route | null = STOREFRONT_EDITOR_HREF;
  return (
    <p className="text-body text-muted">
      Make every parcel feel like your club. Costs are placeholders. Your storefront takes its colours and crest from your{" "}
      <Link href="/brand" className="font-semibold text-link">
        brand kit
      </Link>
      {href ? (
        <>
          {"; "}
          <Link href={href} className="font-semibold text-link">
            edit the storefront
          </Link>
        </>
      ) : null}
      .
    </p>
  );
}

export function BrandingCards({ options, settings, canManage }: Readonly<{ options: readonly BrandingOption[]; settings: StoreSettings; canManage: boolean }>) {
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {options.map((option) => {
        const choice = settings.branding[option.id];
        const on = choice?.on ?? false;
        return (
          <li key={option.id} className="flex flex-col gap-4 rounded-xl bg-soft p-6" data-testid={`branding-${option.id}`}>
            <Picture option={option} />
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-h3 text-text">{option.name}</h2>
              {on ? <StatusPill tone="ok">On</StatusPill> : null}
            </div>
            <p className="text-body text-text-2">{option.description}</p>
            <dl className="flex flex-col gap-1 text-body">
              <dt className="font-semibold text-text">Cost</dt>
              <dd className="text-muted">
                {costLine(option)}
                {option.isPlaceholder && option.costFromMinor ? " (placeholder)" : ""}
              </dd>
              <dt className="mt-2 font-semibold text-text">Details</dt>
              <dd className="text-muted">{option.details}</dd>
              {choice?.note ? (
                <>
                  <dt className="mt-2 font-semibold text-text">Your note</dt>
                  <dd className="text-muted">{choice.note}</dd>
                </>
              ) : null}
            </dl>
            {canManage ? (
              <div>
                <BrandingSetup optionId={option.id} name={option.name} on={on} note={choice?.note ?? ""} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

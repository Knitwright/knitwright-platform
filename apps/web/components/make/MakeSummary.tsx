import { Notice } from "@/components/ui/Notice";
import type { MakeContext } from "@/lib/make/context";
import type { Hero } from "@/lib/make/server";
import { stepLabels } from "@/lib/make/prices";

type Props = Readonly<{ context: MakeContext; hero: Hero | null }>;

/**
 * The left and right halves of the product-created page (F-S7): what the product is, what a piece costs at 1, 50
 * and 100 pieces, when it could be delivered, and the picture.
 *
 * Every price is a price tier of the factory data with that row's own label beside it, and the date is whatever
 * `promisedDate` answers. Neither is ever filled in from nowhere.
 */
export function MakeSummary({ context, hero }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5 rounded-2xl border border-hairline bg-surface p-6">
        <h2 className="text-base font-semibold text-ink">Your product</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
          {context.summary.map((line) => (
            <div key={line.label} className="col-span-2 grid grid-cols-subgrid">
              <dt className="text-muted">{line.label}</dt>
              <dd className="text-ink">{line.value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="make-prices" className="flex flex-col gap-2">
          <h3 id="make-prices" className="text-sm font-medium text-ink">
            What a piece costs
          </h3>
          <ul className="flex flex-col gap-1 text-[15px]">
            {context.prices.map((step) => (
              <li key={step.qty} className="text-muted">
                <span className="text-ink">{step.qty === 1 ? "1 piece" : `${step.qty} pieces`}:</span> {step.text}
              </li>
            ))}
          </ul>
          {stepLabels(context.prices).map((label) => (
            <p key={label} className="text-sm text-faint">
              {label}.
            </p>
          ))}
        </section>

        <section aria-labelledby="make-delivery" className="flex flex-col gap-2">
          <h3 id="make-delivery" className="text-sm font-medium text-ink">
            When it could arrive
          </h3>
          <p className="text-[15px] text-muted">{context.delivery.text}</p>
          {context.delivery.note === "" ? null : <p className="text-sm text-faint">{context.delivery.note}</p>}
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-6">
        <h2 className="text-base font-semibold text-ink">How it looks</h2>
        {hero ? (
          <figure className="flex flex-col gap-2">
            {/* A data address built on the server: no link to storage reaches the browser. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.src} alt={hero.alt} className="w-full rounded-xl border border-hairline bg-white/[0.03]" />
            <figcaption className="text-sm text-faint">{hero.label}</figcaption>
          </figure>
        ) : (
          <Notice>There is no picture of this design yet. Make a render in the design, or add a photo once the sample arrives.</Notice>
        )}
      </div>
    </div>
  );
}

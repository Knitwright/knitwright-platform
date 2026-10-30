"use client";

import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { confirmBenchmarkCardAction, removeBenchmarkCardAction } from "@/lib/benchmarks/actions";
import { cardFeatures, cardFields, FEATURES, type StoredCard } from "@/lib/benchmarks";

/**
 * Confirm or correct a card (spec F-S2 step 4). Every box starts at what was read, with how it is known beside it, so
 * a person can see what the model guessed before they agree to it. Leaving a box empty says "not known", which is the
 * honest answer and is kept as one.
 *
 * Only the fields a person may settle are boxes. The complaint themes are not: they are our summaries of what
 * reviewers said, and a free-text box there would be a way to paste a review back in.
 */

const VALUE_FOR: Readonly<Record<string, (card: StoredCard) => string>> = {
  productName: (card) => card.card.productName.value ?? "",
  brandName: (card) => card.card.brandName.value ?? "",
  price: (card) => (card.card.price.value === null ? "" : (card.card.price.value.minor / 100).toFixed(2)),
  currency: (card) => card.card.price.value?.currency ?? "GBP",
  gsm: (card) => (card.card.gsm.value === null ? "" : String(card.card.gsm.value)),
  fabricComposition: (card) => card.card.fabricComposition.value ?? "",
  fit: (card) => card.card.fit.value ?? "",
  sizeRange: (card) => (card.card.sizeRange.value ?? []).join(", "),
};

const BOXES: readonly Readonly<{ name: keyof typeof VALUE_FOR; label: string }>[] = [
  { name: "productName", label: "Product" },
  { name: "brandName", label: "Sold by" },
  { name: "price", label: "Price" },
  { name: "currency", label: "Currency" },
  { name: "fabricComposition", label: "Fabric" },
  { name: "gsm", label: "Fabric weight (g/m²)" },
  { name: "fit", label: "Fit" },
  { name: "sizeRange", label: "Sizes" },
];

/** Taking a product out of the comparison. Its own form, so a slip on it cannot lose a correction. */
function RemoveCard({ benchmarkId, cardId }: Readonly<{ benchmarkId: string; cardId: string }>) {
  const { form, submit, pending, summary } = useFormAction(removeBenchmarkCardAction);

  return (
    <form ref={form} action={submit} className="mt-3">
      <FormSummary message={summary} />
      <input type="hidden" name="benchmarkId" value={benchmarkId} />
      <input type="hidden" name="cardId" value={cardId} />
      <Button type="submit" variant="quiet" disabled={pending}>
        {pending ? "Removing…" : "Remove this product"}
      </Button>
    </form>
  );
}

export function CardReview({ benchmarkId, card }: Readonly<{ benchmarkId: string; card: StoredCard }>) {
  const { form, submit, pending, fieldErrors, summary } = useFormAction(confirmBenchmarkCardAction);
  const held = new Set(cardFeatures(card.card).map((feature) => feature.key));
  const how = new Map(cardFields(card.card).map((field) => [field.name, field.how]));

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5" data-testid={`card-review-${card.id}`}>
      <h3 className="text-base font-medium text-ink">{card.card.productName.value ?? "Not named"}</h3>
      <p className="mt-1 text-sm text-muted">
        {card.confirmedAt === null ? "Read by " : "Confirmed by your team. Read by "}
        {card.extractor}. Check each line and correct anything that is wrong.
      </p>
      <form ref={form} action={submit} className="mt-5 flex flex-col gap-4">
        <FormSummary message={summary} />
        <input type="hidden" name="benchmarkId" value={benchmarkId} />
        <input type="hidden" name="cardId" value={card.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          {BOXES.map((box) => (
            <Field
              key={box.name}
              name={box.name}
              label={box.label}
              defaultValue={VALUE_FOR[box.name]!(card)}
              hint={how.get(box.name)}
              errors={fieldErrors(box.name)}
            />
          ))}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">What it has</legend>
          <p className="text-sm text-muted">
            Only features a factory makes are here. A logo, a name or a print is never a feature and is never carried onto
            your design.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {FEATURES.filter((feature) => feature.kind !== "graphic").map((feature) => (
              <label key={feature.key} className="flex items-start gap-2 text-[15px] text-ink">
                <input type="checkbox" name="features" value={feature.key} defaultChecked={held.has(feature.key)} className="mt-1" />
                <span>
                  {feature.label}
                  <span className="block text-xs text-muted">{feature.purpose}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Confirm this card"}
          </Button>
        </div>
      </form>
      <RemoveCard benchmarkId={benchmarkId} cardId={card.id} />
    </section>
  );
}

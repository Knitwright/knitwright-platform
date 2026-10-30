"use client";

import { useState } from "react";
import { FormSummary } from "@/components/forms/FormSummary";
import { useFormAction } from "@/components/forms/useFormAction";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { addBenchmarkReviewTextAction, addBenchmarkUrlAction } from "@/lib/benchmarks/actions";
// From the vocabulary, not the barrel: a client component must not pull zod into the browser
// (tests/architecture/client-weight.test.ts).
import { BENCHMARK_USER_AGENT, MAX_CARDS } from "@/lib/benchmarks/vocabulary";

/**
 * Adding a card (spec F-S2 step 1): a product link, or review text a person pasted. Each is its own form, because
 * each can be refused on its own and the refusal is the thing worth reading: a site's robots.txt said no, the page
 * has been read before, the brand has read as many pages as it may for now.
 *
 * What a person is told, in so many words: the page is read once, logged out, and nothing of it is kept.
 */

type Tab = "url" | "reviews";

const TABS: readonly Readonly<{ id: Tab; label: string }>[] = [
  { id: "url", label: "A product link" },
  { id: "reviews", label: "Review text" },
];

function UrlForm({ benchmarkId }: Readonly<{ benchmarkId: string }>) {
  const { form, submit, pending, fieldErrors, summary } = useFormAction(addBenchmarkUrlAction);

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4">
      <FormSummary message={summary} />
      <input type="hidden" name="benchmarkId" value={benchmarkId} />
      <Field
        name="url"
        label="The product page"
        type="url"
        placeholder="https://"
        required
        hint="We read the page once, logged out, and only if the site's robots.txt allows it. Nothing of the page itself is kept."
        errors={fieldErrors("url")}
      />
      <p className="text-sm text-muted">
        We tell the site who we are: <code className="font-mono text-xs">{BENCHMARK_USER_AGENT}</code>
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Reading the page…" : "Read this page"}
      </Button>
    </form>
  );
}

function ReviewsForm({ benchmarkId }: Readonly<{ benchmarkId: string }>) {
  const { form, submit, pending, fieldErrors, summary } = useFormAction(addBenchmarkReviewTextAction);
  const errors = fieldErrors("text");

  return (
    <form ref={form} action={submit} className="flex flex-col gap-4">
      <FormSummary message={summary} />
      <input type="hidden" name="benchmarkId" value={benchmarkId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="benchmark-reviews" className="text-sm font-medium text-ink">
          Paste the reviews
        </label>
        <textarea
          id="benchmark-reviews"
          name="text"
          rows={6}
          required
          minLength={40}
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby="benchmark-reviews-hint"
          className={FIELD_CONTROL}
        />
        <p id="benchmark-reviews-hint" className="text-sm text-muted">
          We read them once and keep only our own short summaries of the themes. The reviews themselves are not stored.
        </p>
        {errors.map((error) => (
          <p key={error} className="text-sm text-warn">
            {error}
          </p>
        ))}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Reading them…" : "Read these reviews"}
      </Button>
    </form>
  );
}

export function AddCard({ benchmarkId, cards }: Readonly<{ benchmarkId: string; cards: number }>) {
  const [tab, setTab] = useState<Tab>("url");

  if (cards >= MAX_CARDS) {
    return (
      <p className="mt-8 rounded-2xl border border-hairline bg-surface p-5 text-[15px] text-muted">
        This comparison holds {MAX_CARDS} products, which is as many as a comparison takes. Remove one to add another.
      </p>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-hairline bg-surface p-5" aria-labelledby="add-card-heading">
      <h2 id="add-card-heading" className="text-lg font-medium text-ink">
        Add a product
      </h2>
      <div role="tablist" aria-label="How to add a product" className="mt-4 flex gap-2">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`add-card-tab-${option.id}`}
            aria-selected={tab === option.id}
            aria-controls={`add-card-panel-${option.id}`}
            onClick={() => setTab(option.id)}
            className={`min-h-10 rounded-full px-4 text-[15px] ${tab === option.id ? "bg-white/12 text-white" : "text-muted"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`add-card-panel-${tab}`}
        aria-labelledby={`add-card-tab-${tab}`}
        className="mt-5"
      >
        {tab === "url" ? <UrlForm benchmarkId={benchmarkId} /> : <ReviewsForm benchmarkId={benchmarkId} />}
      </div>
    </section>
  );
}

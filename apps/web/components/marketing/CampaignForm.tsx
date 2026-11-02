"use client";

import { useId, useState } from "react";
import type { ArtboardPreset } from "@/lib/launch";
import { presetSize } from "@/lib/launch";
import { Notice } from "@/components/ui/Notice";
import {
  CAMPAIGNS,
  CAMPAIGN_LABELS,
  CAMPAIGN_STYLES,
  DESTINATIONS,
  DESTINATION_LABELS,
  EMPTY_FORM,
  HIGHLIGHT_LIMIT,
  MAX_IMAGE_COUNT,
  PRODUCT_SOURCES,
  PRODUCT_SOURCE_LABELS,
  STYLE_LABELS,
  formVerdict,
  generate,
  stepStates,
  stepsDone,
  type Campaign,
  type CampaignForm as FormState,
  type CampaignStyle,
  type Destination,
  type GeneratedArtboard,
  type ProductSource,
} from "@/lib/marketing";
import { PANEL_CHIP, PANEL_FIELD } from "./PanelFrame";

/**
 * THE CAMPAIGN WORKFLOW FORM (spec F-L2 "2. Campaign workflow form": numbered steps on the left, an
 * output example on the right; plan v5 L4, decision 0094).
 *
 * The seven steps, with what each still needs written beside it, and a footer that says how many
 * images it will make. Generating is free and repeatable: the campaign picks the layouts, the style
 * orders them, the destination's own preset row gives the size, and the placed mockups are never
 * moved (`lib/marketing/campaign/generate.ts`).
 */

type Props = Readonly<{
  presets: readonly ArtboardPreset[];
  busy: boolean;
  /** Adds the artboards the form made to the canvas. Null while nothing is wired to it. */
  onAdd: ((artboards: readonly GeneratedArtboard[]) => void) | null;
}>;

const SIZE_FALLBACK = { width: 1080, height: 1350 };

export function CampaignForm({ presets, busy, onAdd }: Props) {
  const ids = { product: useId(), brand: useId(), logo: useId(), highlight: useId(), campaign: useId(), style: useId(), destination: useId(), count: useId() };
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [made, setMade] = useState<readonly GeneratedArtboard[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const states = stepStates(form);
  const verdict = formVerdict(form);
  const change = (over: Partial<FormState>): void => setForm({ ...form, ...over });

  const run = (): void => {
    if (!verdict.ok) return setProblem(verdict.reason);
    const preset = presets.find((one) => one.key === form.destination);
    const size = preset ? presetSize(preset) : SIZE_FALLBACK;
    const result = generate(verdict.form, size);
    if (!result.ok) return setProblem(result.reason);
    setProblem(null);
    setMade(result.artboards);
    onAdd?.(result.artboards);
  };

  return (
    <section aria-label="Campaign workflow" data-testid="marketing-campaign" className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3 className="text-[13px] font-medium text-ink">Product campaign kit</h3>
        <p className="text-[12px] leading-relaxed text-ink-2">{stepsDone(form)} of 7 steps answered. The layouts are built around the picture you pick; the garment in it is never redrawn.</p>
      </header>

      <ol className="flex flex-col gap-3">
        {states.map((step) => (
          <li key={step.id} className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-white/10 bg-tile-2/60 p-3">
            <p className="flex items-baseline gap-2">
              <span aria-hidden="true" className="font-mono text-[11px] text-ink-2">
                {step.number}
              </span>
              <span className="text-[13px] font-medium text-ink">{step.label}</span>
              {step.required ? null : <span className="text-[11px] text-ink-2">optional</span>}
            </p>
            <p className="text-[12px] leading-relaxed text-ink-2">{step.lead}</p>

            {step.id === "product" ? (
              <select
                id={ids.product}
                aria-label={step.label}
                className={PANEL_FIELD}
                disabled={busy}
                value={form.product?.source ?? ""}
                onChange={(event) =>
                  change({ product: event.target.value === "" ? null : { source: event.target.value as ProductSource, id: `${event.target.value}-1`, name: PRODUCT_SOURCE_LABELS[event.target.value as ProductSource] } })
                }
              >
                <option value="">Choose one</option>
                {PRODUCT_SOURCES.map((one) => (
                  <option key={one} value={one}>
                    {PRODUCT_SOURCE_LABELS[one]}
                  </option>
                ))}
              </select>
            ) : null}

            {step.id === "brand" ? (
              <div className="flex items-center gap-2">
                <input
                  id={ids.brand}
                  type="checkbox"
                  className="size-4 accent-cobalt-soft"
                  checked={form.applyBrand}
                  disabled={busy}
                  onChange={(event) => change({ applyBrand: event.target.checked, brandId: event.target.checked ? form.brandId : null })}
                />
                <label htmlFor={ids.brand} className="text-[13px] text-ink">
                  Apply your brand
                </label>
              </div>
            ) : null}

            {step.id === "logo" ? (
              <div className="flex items-center gap-2">
                <input id={ids.logo} type="checkbox" className="size-4 accent-cobalt-soft" checked={form.logoFileId !== null} disabled={busy} onChange={(event) => change({ logoFileId: event.target.checked ? "logo-1" : null })} />
                <label htmlFor={ids.logo} className="text-[13px] text-ink">
                  Place your logo or crest
                </label>
              </div>
            ) : null}

            {step.id === "highlight" ? (
              <input id={ids.highlight} type="text" aria-label={step.label} maxLength={HIGHLIGHT_LIMIT} className={PANEL_FIELD} disabled={busy} value={form.highlight} placeholder="Pre-orders close Friday" onChange={(event) => change({ highlight: event.target.value })} />
            ) : null}

            {step.id === "campaign" ? (
              <select id={ids.campaign} aria-label={step.label} className={PANEL_FIELD} disabled={busy} value={form.campaign ?? ""} onChange={(event) => change({ campaign: event.target.value === "" ? null : (event.target.value as Campaign) })}>
                <option value="">Choose one</option>
                {CAMPAIGNS.map((one) => (
                  <option key={one} value={one}>
                    {CAMPAIGN_LABELS[one]}
                  </option>
                ))}
              </select>
            ) : null}

            {step.id === "style" ? (
              <ul className="flex flex-wrap gap-2">
                {CAMPAIGN_STYLES.map((one) => (
                  <li key={one}>
                    <button type="button" disabled={busy} aria-pressed={form.style === one} className={PANEL_CHIP} onClick={() => change({ style: one as CampaignStyle })}>
                      {STYLE_LABELS[one]}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {step.id === "destination" ? (
              <select id={ids.destination} aria-label={step.label} className={PANEL_FIELD} disabled={busy} value={form.destination ?? ""} onChange={(event) => change({ destination: event.target.value === "" ? null : (event.target.value as Destination) })}>
                <option value="">Choose one</option>
                {DESTINATIONS.map((one) => (
                  <option key={one} value={one}>
                    {DESTINATION_LABELS[one]}
                  </option>
                ))}
              </select>
            ) : null}

            {step.needs ? <p className="text-[12px] leading-relaxed text-warn">{step.needs}</p> : null}
          </li>
        ))}
      </ol>

      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={ids.count} className="text-[13px] font-medium text-ink">
          How many
        </label>
        <select id={ids.count} className={PANEL_FIELD} disabled={busy} value={form.imageCount} onChange={(event) => change({ imageCount: Number(event.target.value) })}>
          {Array.from({ length: MAX_IMAGE_COUNT }, (_one, index) => index + 1).map((count) => (
            <option key={count} value={count}>
              {count === 1 ? "1 layout" : `${count} layouts`}
            </option>
          ))}
        </select>
      </div>

      {problem ? (
        <Notice tone="warn" role="alert">
          {problem}
        </Notice>
      ) : null}

      <button type="button" disabled={busy || !verdict.ok} onClick={run} className={PANEL_CHIP} data-testid="marketing-campaign-run">
        Generate {form.imageCount === 1 ? "1 layout" : `${form.imageCount} layouts`} · free
      </button>
      <p className="text-[12px] leading-relaxed text-ink-2">These layouts are drawn by the platform, so they cost nothing. Write for me is the only part that is metered.</p>

      <div aria-live="polite">
        {made.length > 0 ? (
          <ul className="flex flex-col gap-1.5" data-testid="marketing-campaign-results">
            {made.map((artboard) => (
              <li key={artboard.layoutKey} className="text-[12px] leading-relaxed text-ink-2">
                <span className="text-ink">{artboard.title}</span> · {artboard.size.width} × {artboard.size.height} px
              </li>
            ))}
          </ul>
        ) : null}
        {made.length > 0 && onAdd === null ? <p className="text-[12px] text-ink-2">Nothing has been added to the canvas: that is not connected yet.</p> : null}
      </div>
    </section>
  );
}

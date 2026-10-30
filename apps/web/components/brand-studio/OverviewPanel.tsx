import Link from "next/link";
import { allAssetFindings, type CheckedAsset } from "@/lib/brand-studio/assets";
import { colourFindings } from "@/lib/brand-studio/colours";
import { CLUB_KIT_NOTE } from "@/lib/brand-studio/club-kit";
import { completionOf, stillToDo, WEIGHT_SOURCE } from "@/lib/brand-studio/completion";
import type { BrandRecord } from "@/lib/brand-studio/types";
import { CATEGORY_LABELS, VOICE_TAG_LABELS } from "@/lib/brand-studio/words";
import { FindingList } from "./FindingList";

type Props = Readonly<{ record: BrandRecord; checked: readonly CheckedAsset[] }>;

const CARD = "flex flex-col gap-1 rounded-2xl border border-hairline bg-white/[0.03] px-4 py-3";

/** The Overview tab of F-S9: a card per part with its count, the completion % and what is left. */
export function OverviewPanel({ record, checked }: Props) {
  const completion = completionOf(record);
  const left = stillToDo(completion);
  const readThrough = record.palettes.some((palette) => palette.source === "club-kit") || record.assets.some((asset) => asset.source === "club-kit");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <p className="rounded-full border border-cobalt-soft/30 bg-cobalt-wash px-4 py-2 text-[15px] text-ink" data-testid="brand-completion">
          {completion.percent}% complete
        </p>
        <p className="text-[13px] text-muted">{WEIGHT_SOURCE}.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {completion.steps.map((step) => (
          <li key={step.key} className={CARD}>
            <span className="text-[15px] text-ink">{step.label}</span>
            <span className="text-[13px] text-muted">
              {step.count === null ? (step.done ? "Added" : "Needs your input") : `${step.count} so far`}
            </span>
          </li>
        ))}
      </ul>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className={CARD}>
          <dt className="text-[13px] text-muted">Category</dt>
          <dd className="text-[15px] text-ink">{CATEGORY_LABELS[record.profile.category]}</dd>
        </div>
        <div className={CARD}>
          <dt className="text-[13px] text-muted">Voice and tone</dt>
          <dd className="text-[15px] text-ink">
            {record.profile.voiceTags.length === 0 ? "Needs your input" : record.profile.voiceTags.map((tag) => VOICE_TAG_LABELS[tag]).join(" · ")}
          </dd>
        </div>
      </dl>

      {readThrough ? <p className="text-[13px] text-muted">{CLUB_KIT_NOTE}</p> : null}

      {left.length === 0 ? null : (
        <section aria-label="Still to do" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Still to do</p>
          <ul className="flex flex-col gap-1.5">
            {left.map((step) => (
              <li key={step.key} className="text-[13px] text-muted">
                <span className="text-ink">{step.label}:</span> {step.asks}
              </li>
            ))}
          </ul>
        </section>
      )}

      <FindingList title="What we noticed" findings={[...colourFindings(record.palettes), ...allAssetFindings(checked)]} />

      <p className="text-[13px] text-muted">
        Your club kit and rosters are on the <Link href="/club" className="soft-link text-cobalt-soft">Club page</Link>.
      </p>
    </div>
  );
}

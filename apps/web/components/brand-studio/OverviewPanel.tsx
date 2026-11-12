import Link from "next/link";
import { allAssetFindings, type CheckedAsset } from "@/lib/brand-studio/assets";
import { colourFindings } from "@/lib/brand-studio/colours";
import { CLUB_KIT_NOTE } from "@/lib/brand-studio/club-kit";
import { completionOf, stillToDo, WEIGHT_SOURCE } from "@/lib/brand-studio/completion";
import type { BrandRecord } from "@/lib/brand-studio/types";
import { CATEGORY_LABELS, VOICE_TAG_LABELS } from "@/lib/brand-studio/words";
import { OverviewCards } from "@/components/brand/v3/OverviewCards";
import { overviewCards } from "@/lib/brand-studio/overview-cards";
import { FindingList } from "./FindingList";

type Props = Readonly<{ record: BrandRecord; checked: readonly CheckedAsset[] }>;

const CARD = "flex flex-col gap-1 rounded-2xl border border-hairline bg-white/[0.03] px-4 py-3";

/** The Overview tab of F-S9: a card per part with its count, then what is left and what we noticed. */
export function OverviewPanel({ record, checked }: Props) {
  const completion = completionOf(record);
  const left = stillToDo(completion);
  const readThrough = record.palettes.some((palette) => palette.source === "club-kit") || record.assets.some((asset) => asset.source === "club-kit");

  return (
    <div className="flex flex-col gap-6">
      {/* The Kittl Overview cards (08 §4.6, d17); the completion % is on the side card (decision 0144). */}
      <OverviewCards cards={overviewCards(record)} />
      <p className="text-[13px] text-muted">Completion: {completion.percent}%, by {WEIGHT_SOURCE}.</p>

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
        Your club kit is on the <Link href="/brand?tab=sportswear" className="soft-link text-ink underline underline-offset-4">Sportswear tab</Link>, and your rosters are on{" "}
        <Link href="/team" className="soft-link text-ink underline underline-offset-4">Team</Link>.
      </p>
    </div>
  );
}

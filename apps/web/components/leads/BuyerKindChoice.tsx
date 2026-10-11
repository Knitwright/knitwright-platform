"use client";

import { BUYER_KINDS } from "@/lib/leads/buyer-kind";

type Props = Readonly<{ value: string; onChange: (kind: string) => void }>;

/** The first question of the guided start: which path fits (Platform and Store Guide, module 1). */
export function BuyerKindChoice({ value, onChange }: Props) {
  return (
    <fieldset className="rounded-2xl border border-hairline bg-surface p-6">
      <legend className="px-1 text-lg font-semibold text-ink">First, which fits you best?</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {BUYER_KINDS.map((kind) => (
          <label
            key={kind.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline p-3 has-[:checked]:border-cobalt has-[:checked]:bg-shell"
          >
            <input
              type="radio"
              name="buyer-kind-choice"
              value={kind.id}
              checked={value === kind.id}
              onChange={() => onChange(kind.id)}
              className="mt-1"
            />
            <span>
              <span className="block text-[15px] font-medium text-ink">{kind.label}</span>
              <span className="block text-sm text-muted">{kind.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

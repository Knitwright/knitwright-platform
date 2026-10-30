"use client";

import { useId } from "react";
import { optionGroups, parameterSliders, type FormValues, type OptionGroupView, type OptionTile, type ParameterSlider } from "@/lib/editor";
import type { BaseArticle } from "@/lib/catalogue";
import { WhyButton } from "./WhyButton";

type Props = Readonly<{
  article: BaseArticle | null;
  form: FormValues;
  busy: boolean;
  onOption: (group: string, code: string) => void;
  onParameter: (key: string, mm: number) => void;
}>;

/**
 * The Form toolbar (spec F-S4). Every tile is one of the base article's approved options, with its
 * catalogue code; every slider runs from the minimum the factory approved to the maximum, in the
 * article's own step, so an out-of-range value cannot be reached. An option or range no golden
 * sample has signed off carries a lock mark, the words "Not yet sampled" and a Why? link.
 */
export function FormToolbar({ article, form, busy, onOption, onParameter }: Props) {
  if (!article) {
    return (
      <p className="text-[13px] leading-relaxed text-chalk-muted" data-testid="form-toolbar-none">
        This design is not on a base article yet, so there is no factory-approved form to change.
      </p>
    );
  }
  const groups = optionGroups(article, form);
  const sliders = parameterSliders(article, form);
  if (groups.length === 0 && sliders.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-chalk-muted" data-testid="form-toolbar-empty">
        {article.code} has no approved options or ranges on file yet. {article.dataLabel}.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4" data-testid="form-toolbar">
      {groups.map((group) => (
        <OptionTiles key={group.group} group={group} busy={busy} onOption={onOption} />
      ))}
      {sliders.map((slider) => (
        <Slider key={slider.key} slider={slider} busy={busy} onParameter={onParameter} />
      ))}
    </div>
  );
}

const NOT_SAMPLED_NOTE = "No golden sample has signed this off yet, so it is not approved for production.";

function OptionTiles({ group, busy, onOption }: Readonly<{ group: OptionGroupView; busy: boolean; onOption: (group: string, code: string) => void }>) {
  const id = useId();
  // A radio group, not a fieldset: the garment registry already has option groups of its own in
  // the Garment panel, and two groups of the same name would be one control to a screen reader.
  return (
    <div role="radiogroup" aria-labelledby={`${id}-legend`} className="rounded-2xl border border-white/10 p-3" data-testid={`option-group-${group.group}`}>
      <p id={`${id}-legend`} className="px-1 font-mono text-[11px] font-medium tracking-[0.08em] text-chalk-muted uppercase">
        {group.label} options of {group.articleCode}
      </p>
      <div className="mt-1 flex flex-col gap-1">
        {group.tiles.map((tile) => (
          <Tile key={tile.code} tile={tile} group={group.group} groupId={id} busy={busy} onOption={onOption} />
        ))}
      </div>
    </div>
  );
}

function Tile({ tile, group, groupId, busy, onOption }: Readonly<{ tile: OptionTile; group: string; groupId: string; busy: boolean; onOption: (group: string, code: string) => void }>) {
  const inputId = `${groupId}-${tile.code}`;
  const noteId = tile.lockNote ? `${inputId}-note` : undefined;
  return (
    <div>
      <label htmlFor={inputId} className="flex min-h-10 items-center gap-3 text-[13px] text-ink">
        <input
          id={inputId}
          type="radio"
          name={`${groupId}-option`}
          value={tile.code}
          checked={tile.chosen}
          disabled={busy}
          aria-describedby={noteId}
          onChange={() => onOption(group, tile.code)}
          className="size-4 shrink-0 accent-cobalt"
        />
        <span className="min-w-0 flex-1">
          <span className="font-mono text-[11px] text-chalk-muted">{tile.code}</span> {tile.label}
          {tile.extraCost ? <span className="block text-[11px] text-ink-2">{tile.extraCost}</span> : null}
        </span>
      </label>
      {tile.lockNote ? (
        <p className="ml-7 flex flex-wrap items-center gap-1 text-[11px] text-warn">
          <span aria-hidden="true">&#128274;</span>
          <span id={noteId}>
            {tile.lockNote}. {NOT_SAMPLED_NOTE}
          </span>
          <WhyButton ruleId={tile.ruleId} context={`form option ${group} ${tile.code}`} />
        </p>
      ) : null}
    </div>
  );
}

function Slider({ slider, busy, onParameter }: Readonly<{ slider: ParameterSlider; busy: boolean; onParameter: (key: string, mm: number) => void }>) {
  const id = useId();
  return (
    <div className="rounded-2xl border border-white/10 p-3" data-testid={`parameter-${slider.key}`}>
      <label htmlFor={id} className="block text-[13px] text-ink">
        {slider.rangeLabel}
      </label>
      <input
        id={id}
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={slider.value}
        disabled={busy}
        onChange={(event) => onParameter(slider.key, Number(event.target.value))}
        className="mt-1 h-10 w-full accent-cobalt"
      />
      <p className="flex flex-wrap items-center gap-1 text-[11px] text-chalk-muted">
        {slider.pomLetters.length > 0 ? <span>Moves {slider.pomLetters.join(", ")}.</span> : null}
        {slider.lockNote ? <span className="text-warn">&#128274; {slider.lockNote}.</span> : null}
        <WhyButton ruleId={slider.ruleId} context={`form parameter ${slider.key}`} />
      </p>
    </div>
  );
}

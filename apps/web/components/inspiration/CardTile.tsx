import type { CardView } from "@/lib/inspiration/view";
import { openProps, suggestProps } from "./a11y";

type Props = Readonly<{
  card: CardView;
  onSuggest?: () => void;
  onSave?: () => void;
  busy?: boolean;
}>;

/**
 * One inspiration card: the picture the provider serves, its source, its attribution and the two things a person can
 * do with it. The picture is hotlinked, as Unsplash's and Pexels' terms require, and never copied to Knitwright.
 */
export function CardTile({ card, onSuggest, onSave, busy = false }: Props) {
  return (
    <li className="glass flex w-44 shrink-0 flex-col gap-2 rounded-2xl p-2 text-left" data-testid="inspiration-card" data-card-id={card.id}>
      <a {...openProps(card.openUrl, card.openLabel)} className="block overflow-hidden rounded-xl">
        {card.previewUrl === "" ? (
          <span className="flex h-28 items-center justify-center text-xs text-muted">No picture</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- hotlinked from the provider, as their terms require; never stored.
          <img src={card.previewUrl} alt={card.title} loading="lazy" referrerPolicy="no-referrer" className="h-28 w-full object-cover" />
        )}
      </a>
      <p className="text-xs font-medium text-ink">{card.title}</p>
      <p className="text-[0.7rem] text-muted">
        <span className="font-medium">{card.sourceLabel}</span>
        {card.aiLabel === null ? null : <span className="ml-1 rounded-full border border-hairline px-1">{card.aiLabel}</span>}
      </p>
      <p className="text-[0.7rem] text-muted">{card.notice}</p>
      <div className="flex flex-wrap gap-2">
        <button {...suggestProps(card.suggestLabel)} onClick={onSuggest} disabled={busy} className="soft-link text-xs font-medium">
          Suggest from this
        </button>
        {card.unsaveable === null ? (
          <button type="button" onClick={onSave} disabled={busy} aria-label={`Save "${card.title}" to the moodboard`} className="soft-link text-xs font-medium">
            Save
          </button>
        ) : (
          <span className="text-[0.7rem] text-muted">{card.unsaveable}</span>
        )}
      </div>
    </li>
  );
}

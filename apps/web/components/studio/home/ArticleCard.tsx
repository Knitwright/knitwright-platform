import type { Route } from "next";
import Link from "next/link";
import { GarmentOutline } from "@/components/home/GarmentOutline";
import { RENDER_NOTICE } from "@/lib/home/article-view";
import { EDIT_FORM_LABEL, type ArticleCardView } from "@/lib/home/catalogue-view";

/**
 * One base article in the catalogue grid (spec F-S4, "Grid cards"): the picture, the name, the code,
 * the class and status tags, the "From £x · from 1 pc" line and the icon that marks an article whose
 * form can be edited.
 *
 * The picture is a placeholder outline and says "Render, not photo": no sample has been
 * photographed. The price carries the label of the row it came from, so it can never read as a
 * factory quote.
 */
export function ArticleCard({ card }: Readonly<{ card: ArticleCardView }>) {
  return (
    <article className="glass lift flex h-full flex-col overflow-hidden rounded-[1.75rem]">
      {/* No text sits over the dotted pattern: a background image leaves nothing to judge contrast against. */}
      <div className="dot-grid grid h-36 place-items-center border-b border-white/8 p-4">
        <GarmentOutline />
      </div>
      <div className="lift-caption flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-[16px] font-medium leading-snug tracking-[-0.01em] text-ink">
          <Link href={card.href as Route} className="text-ink no-underline after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-cobalt-soft">
            {card.name}
          </Link>
        </h3>
        <p className="font-mono text-[12px] text-muted">
          {card.code} · {RENDER_NOTICE.label}
        </p>
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <li
              key={tag.label}
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] ${
                tag.tone === "class" ? "bg-cobalt-wash text-cobalt-soft" : "bg-white/8 text-muted"
              }`}
            >
              {tag.label}
            </li>
          ))}
        </ul>
        <p className="mt-auto pt-2 text-[14.5px] font-medium text-ink">{card.price.line}</p>
        {card.price.label ? <p className="text-[11.5px] text-faint">{card.price.label}</p> : null}
        {card.price.note ? <p className="text-[11.5px] text-warn">{card.price.note}</p> : null}
        {card.editableForm ? <EditFormMark hint={card.formHint!} /> : null}
        <p className="text-[11.5px] text-faint">{card.dataLabel}</p>
      </div>
    </article>
  );
}

/**
 * The icon that marks an article with options and ranges a founder can change. Its name is the
 * spec's "Edit this product's form"; the sentence under it is built from the article's own options,
 * so it never promises a change the rows do not hold.
 */
function EditFormMark({ hint }: Readonly<{ hint: string }>) {
  return (
    <p className="relative z-10 flex items-start gap-2 text-[12px] text-ink-2">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="mt-0.5 flex-none">
        <path d="M2 11.5 11 2.5l2.5 2.5L4.5 14H2z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <span>
        <span className="font-medium text-ink">{EDIT_FORM_LABEL}</span>
        {": "}
        {hint}
      </span>
    </p>
  );
}

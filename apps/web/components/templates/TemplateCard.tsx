import { getType } from "@/lib/garment";
import { SPORT_LABELS, REVIEW_LABELS, STYLE_LABELS } from "@/lib/templates/catalogue";
import { COLOUR_FAMILY_LABELS } from "@/lib/templates/colour-family";
import type { TemplateSummary } from "@/lib/templates/filters";
import type { TemplatePreview } from "@/lib/templates/preview";
import { UseTemplate } from "./UseTemplate";

type CardProps = Readonly<{ template: TemplateSummary; preview: TemplatePreview | null }>;

/** One template: the drawing of its front, what it is, and the button that makes a copy of it. */
export function TemplateCard({ template, preview }: CardProps) {
  const article = getType(template.articleId)?.label ?? template.articleId;
  return (
    <article className="glass flex h-full flex-col gap-3 rounded-[1.75rem] p-4" aria-labelledby={`template-${template.slug}`}>
      <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-2xl bg-white/[0.04]">
        {/* A data address of a drawing made here: nothing in it can run, and there is nothing to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview.src} alt={preview.alt} className="size-full object-contain p-3" /> : <p className="text-sm text-muted">No drawing yet</p>}
      </div>
      <div className="flex flex-col gap-1">
        <h2 id={`template-${template.slug}`} className="text-lg font-medium tracking-[-0.01em] text-ink">
          {template.title}
        </h2>
        <p className="font-mono text-[13px] text-muted">
          {article} · {SPORT_LABELS[template.sport]} · {STYLE_LABELS[template.style]} · {COLOUR_FAMILY_LABELS[template.colourFamily]}
        </p>
        <p className="mt-1 w-fit rounded-full bg-warn-wash px-2.5 py-0.5 text-xs text-warn">{REVIEW_LABELS[template.reviewState]}</p>
      </div>
      <div className="mt-auto">
        <UseTemplate templateId={template.id} title={template.title} />
      </div>
    </article>
  );
}

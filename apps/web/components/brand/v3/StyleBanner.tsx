import { LinkButton } from "@/components/ui/LinkButton";

/**
 * The gold banner over the Brand tabs (08 §4.6, d17). Once the three visual-style texts are written it
 * says so and opens AI workflows, which read them. Before, it offers the import that drafts them.
 */
export function StyleBanner({ set, canEdit }: Readonly<{ set: boolean; canEdit: boolean }>) {
  if (!set && !canEdit) return null;
  return (
    <section aria-label="Visual style" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold bg-gold-soft px-5 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-body font-bold text-text">{set ? "Your visual style is set!" : "Import your brand"}</p>
        <p className="text-body text-text-2">
          {set
            ? "Setting, art direction and rules are captured. Use them in AI workflows."
            : "Paste your website or Instagram link and Knitwright drafts your colours, fonts and visual style for you to check."}
        </p>
      </div>
      <LinkButton href={set ? "/ai-studio" : "/brand/import"} size="sm">
        {set ? "Try in AI workflows" : "Import from a link"}
      </LinkButton>
    </section>
  );
}

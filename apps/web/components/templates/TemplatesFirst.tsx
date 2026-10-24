import { LinkButton } from "@/components/ui/LinkButton";
import type { TemplateSummary } from "@/lib/templates/filters";
import type { TemplatePreview } from "@/lib/templates/preview";
import { TemplateCard } from "./TemplateCard";

type FirstProps = Readonly<{ templates: readonly { template: TemplateSummary; preview: TemplatePreview | null }[] }>;

/** The start of the guided flow offers finished designs first. Nothing when the library is empty. */
export function TemplatesFirst({ templates }: FirstProps) {
  if (templates.length === 0) return null;
  return (
    <section aria-labelledby="start-templates" className="mb-10 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="start-templates" className="text-xl font-medium tracking-[-0.01em] text-ink">
            Start from a template
          </h2>
          <p className="mt-1 text-[15px] text-muted">Finished designs on garments we can make. Change anything after.</p>
        </div>
        <LinkButton href="/templates" variant="secondary">
          Browse all templates
        </LinkButton>
      </div>
      <ul aria-label="Featured templates" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {templates.map(({ template, preview }) => (
          <li key={template.id}>
            <TemplateCard template={template} preview={preview} />
          </li>
        ))}
      </ul>
      <h2 className="mt-4 text-xl font-medium tracking-[-0.01em] text-ink">Or start from a blank canvas</h2>
    </section>
  );
}

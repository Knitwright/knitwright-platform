import type { Metadata } from "next";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { TemplateFilters } from "@/components/templates/TemplateFilters";
import { TemplatePager } from "@/components/templates/TemplatePager";
import { PageIntro } from "@/components/shell/PageIntro";
import { LinkButton } from "@/components/ui/LinkButton";
import { readPage } from "@/lib/pagination/pages";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { filtersFromQuery, listTemplates } from "@/lib/templates/filters";
import { articleChoices } from "@/lib/templates/library";
import { previewOf } from "@/lib/templates/preview";
import { loadLibrary, loadSnapshots } from "@/lib/templates/service";

export const metadata: Metadata = { title: "Templates" };

/** The template library: finished designs to start from, filtered, one page at a time. A blank canvas is the exception. */
export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const filters = filtersFromQuery(query);
  const client = await sessionClient();
  const all = await loadLibrary(client);
  const found = listTemplates(all, filters, readPage(query.page));
  const snapshots = await loadSnapshots(client, found.rows.map((row) => row.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageIntro
          eyebrow={brand.name}
          title="Templates"
          lead="Start from a finished design and change anything. Using a template makes your own copy; the template stays as it is."
        />
        <LinkButton href="/studio/start" variant="secondary">
          Start from a blank canvas
        </LinkButton>
      </div>
      <TemplateFilters filters={filters} articles={articleChoices(all)} />
      <p className="font-mono text-[13px] text-muted" aria-live="polite">
        {found.total === 1 ? "1 template" : `${found.total} templates`}
        {found.totalPages > 1 ? `, page ${found.page} of ${found.totalPages}` : ""}
      </p>
      {found.rows.length === 0 ? (
        <p className="glass rounded-[1.75rem] p-6 text-[15px] text-ink-2">
          No template matches those filters. Clear a filter, or start from a blank canvas.
        </p>
      ) : (
        <ul aria-label="Templates" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {found.rows.map((template) => (
            <li key={template.id}>
              <TemplateCard template={template} preview={previewOf(snapshots.get(template.id))} />
            </li>
          ))}
        </ul>
      )}
      <TemplatePager path="/templates" filters={filters} page={found.page} totalPages={found.totalPages} />
    </div>
  );
}

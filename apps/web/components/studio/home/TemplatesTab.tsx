import { TemplateCard } from "@/components/templates/TemplateCard";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { SPORTS, SPORT_LABELS, STYLE_IDS, STYLE_LABELS } from "@/lib/templates/catalogue";
import { applyFilters, filtersFromQuery } from "@/lib/templates/filters";
import { previewOf } from "@/lib/templates/preview";
import { loadLibrary, loadSnapshots } from "@/lib/templates/service";
import { sessionClient } from "@/lib/server/deps";

/**
 * The catalogue's Templates tab (spec F-S4, "Base product and template catalogue"). It lists the
 * template library (V3's rows) with the two filters a template row carries, Sport and Style; the
 * other filters belong to base products, and the panel says so rather than offering a filter that
 * would do nothing.
 */

type TabProps = Readonly<{
  query: Readonly<Record<string, string | string[] | undefined>>;
  /** The tab, sort and market, kept when the filters are submitted. */
  keep: Readonly<Record<string, string>>;
}>;

export async function TemplatesTab({ query, keep }: TabProps) {
  const client = await sessionClient();
  const all = await loadLibrary(client);
  const filters = filtersFromQuery(query);
  const rows = applyFilters(all, { sport: filters.sport, style: filters.style });
  const snapshots = await loadSnapshots(client, rows.map((row) => row.id));

  return (
    <div className="flex flex-col gap-5">
      <form method="get" action="/catalogue" aria-label="Filter the templates" className="glass flex flex-wrap items-end gap-3 rounded-[1.6rem] p-5">
        {Object.entries(keep).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <SelectField
          name="sport"
          label="Sport"
          placeholder="Any sport"
          defaultValue={filters.sport ?? ""}
          options={SPORTS.map((id) => ({ id, label: SPORT_LABELS[id] }))}
        />
        <SelectField
          name="style"
          label="Style"
          placeholder="Any style"
          defaultValue={filters.style ?? ""}
          options={STYLE_IDS.map((id) => ({ id, label: STYLE_LABELS[id] }))}
        />
        <Button type="submit" variant="secondary">
          Show templates
        </Button>
        <p className="w-full text-[13px] text-muted">
          Article type, fit, gender, production class and fabric filter base products, not templates.
        </p>
      </form>
      <p className="font-mono text-[13px] text-muted" aria-live="polite">
        {rows.length === 1 ? "1 template" : `${rows.length} templates`}
      </p>
      {rows.length === 0 ? (
        <p className="glass rounded-[1.5rem] p-6 text-[15px] text-ink-2">No template matches those filters. Clear a filter.</p>
      ) : (
        <ul aria-label="Templates" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((template) => (
            <li key={template.id}>
              <TemplateCard template={template} preview={previewOf(snapshots.get(template.id))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

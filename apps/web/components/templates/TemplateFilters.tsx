import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { SPORTS, SPORT_LABELS, STYLE_IDS, STYLE_LABELS } from "@/lib/templates/catalogue";
import { COLOUR_FAMILIES, COLOUR_FAMILY_LABELS } from "@/lib/templates/colour-family";
import type { TemplateFilters as Filters } from "@/lib/templates/filters";

type FilterProps = Readonly<{ filters: Filters; articles: readonly { id: string; label: string }[] }>;

/** The four filters, as a plain form that reloads the page. It works without a script and always starts again at page 1. */
export function TemplateFilters({ filters, articles }: FilterProps) {
  return (
    <form method="get" role="search" aria-label="Filter templates" className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <SelectField name="sport" label="Sport" placeholder="Any sport" defaultValue={filters.sport ?? ""} options={SPORTS.map((id) => ({ id, label: SPORT_LABELS[id] }))} />
      <SelectField name="article" label="Garment" placeholder="Any garment" defaultValue={filters.article ?? ""} options={articles} />
      <SelectField name="style" label="Style" placeholder="Any style" defaultValue={filters.style ?? ""} options={STYLE_IDS.map((id) => ({ id, label: STYLE_LABELS[id] }))} />
      <SelectField
        name="colour"
        label="Colour family"
        placeholder="Any colour"
        defaultValue={filters.colour ?? ""}
        options={COLOUR_FAMILIES.map((id) => ({ id, label: COLOUR_FAMILY_LABELS[id] }))}
      />
      <Button type="submit" variant="secondary">
        Show templates
      </Button>
    </form>
  );
}

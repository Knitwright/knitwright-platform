import { Notice } from "@/components/ui/Notice";
import type { TechPackPageData } from "@/lib/projects/tech-pack-data";
import { SECTION_GUIDANCE, fieldFor, sectionHasForms, sectionLink, summaryTone } from "@/lib/projects/tech-pack-view";
import type { ConfirmItem, ConfirmSection } from "@/lib/techpack";

/** One thing to fill in, as a link that opens the form and moves focus to its field. */
function ConfirmItemLink({ item }: Readonly<{ item: ConfirmItem }>) {
  const field = fieldFor(item);
  const text = item.detail ? `${item.label}: ${item.detail}` : item.label;
  if (!field) return <span>{`${text} (set this in the design editor)`}</span>;
  return (
    <a
      href={sectionLink(item.sectionId)}
      className="underline underline-offset-4"
      data-opens-forms="true"
      data-focus-form={field.form}
      {...(field.field ? { "data-focus-field": field.field } : {})}
    >
      {text}
    </a>
  );
}

/** A section of the confirm list: what is needed and why, then each thing as a link to its field. */
function ConfirmSectionEntry({ section }: Readonly<{ section: ConfirmSection }>) {
  return (
    <li>
      <a
        href={sectionLink(section.id)}
        className="font-medium underline underline-offset-4"
        {...(sectionHasForms(section.id) ? { "data-opens-forms": "true" } : {})}
      >
        {section.title}
      </a>
      : {section.items.length}
      {SECTION_GUIDANCE[section.id] ? <p className="mt-0.5 text-sm">{SECTION_GUIDANCE[section.id]}</p> : null}
      <details className="mt-1">
        <summary className="cursor-pointer text-sm">{`Show the ${section.items.length === 1 ? "thing" : `${section.items.length} things`} to fill in`}</summary>
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-sm">
          {section.items.map((item) => (
            <li key={`${item.target}|${item.label}`}>
              <ConfirmItemLink item={item} />
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

/**
 * What is still to be confirmed, as a count at the top, then each section with one sentence on
 * what a factory needs from it, and a link to every field. Markup only: the count and every
 * name come from the completeness report.
 */
export function ConfirmSummary({ data }: Readonly<{ data: TechPackPageData }>) {
  const { report } = data;
  return (
    <Notice tone={summaryTone(report)}>
      <p className="font-medium" data-testid="confirm-count">
        {data.sentence}
      </p>
      <p className="mt-1" data-testid="unconfirmed-counts">
        <a href={sectionLink("suggested")} className="underline underline-offset-4">
          {`${report.suggested} ${report.suggested === 1 ? "suggestion" : "suggestions"} and ${report.proposed} ${report.proposed === 1 ? "proposal" : "proposals"} by Knitwright`}
        </a>
        , not confirmed by anyone. Each section shows them with a button to confirm them as your own.
      </p>
      {report.sections.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3" data-testid="confirm-list">
          {report.sections.map((section) => (
            <ConfirmSectionEntry key={section.id} section={section} />
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}

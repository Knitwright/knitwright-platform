import type { Route } from "next";
import Link from "next/link";
import { JourneySteps } from "@/components/ui/JourneySteps";
import type { TechPackCoreData } from "@/lib/projects/tech-pack-data";
import { sectionSearch } from "@/lib/projects/tech-pack-sections";
import { HeaderDownloads } from "./TechPackDownloads";

type HeaderProps = Readonly<{
  data: TechPackCoreData;
  colourwayId?: string | undefined;
  /** The query of the page, less the section. */
  baseSearch: string;
}>;

/**
 * The top of the factory file: the way back to the design, the name and version, the journey
 * step it is, and the downloads.
 */
export function FileHeader({ data, colourwayId, baseSearch }: HeaderProps) {
  const design = `/studio/${data.projectId}` as Route;
  const here = `/studio/${data.projectId}/tech-pack`;
  const steps = [
    { label: "Design", href: design },
    { label: "Factory file", href: null },
    { label: "Committee", href: null },
    { label: "Quote", href: `${here}${sectionSearch(baseSearch, "quote")}` as Route },
  ];
  return (
    <header className="glass flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link href={design} className="soft-link inline-flex min-h-10 items-center text-sm text-cobalt-soft hover:underline">
          Back to the design
        </Link>
        <div className="flex min-w-0 flex-col">
          <p className="font-mono text-xs uppercase tracking-wider text-muted">Factory file (tech pack)</p>
          <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[28px]">{data.name}</h1>
          <p className="text-sm text-muted">Version {data.version}</p>
        </div>
        <div className="min-w-0 max-w-full lg:ml-auto">
          <JourneySteps steps={steps} current={1} />
        </div>
      </div>
      <HeaderDownloads projectId={data.projectId} version={data.version} colourwayId={colourwayId} dxfHref={sectionSearch(baseSearch, "patterns")} />
    </header>
  );
}

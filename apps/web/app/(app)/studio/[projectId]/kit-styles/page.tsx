import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { KitStyleGallery } from "@/components/kit-styles/KitStyleGallery";
import { PatternLooks } from "@/components/kit-styles/PatternLooks";
import { brandChartSet } from "@/lib/charts/service";
import { guideAddress } from "@/lib/guided/flow";
import { GALLERY_FROM, kitStyleTiles, type GalleryFrom } from "@/lib/kit-styles/gallery";
import { clubColoursFrom, kitStylesFor, readClubColours } from "@/lib/kit-styles/presets";
import { galleryTiles } from "@/lib/pattern-generators/gallery";
import { getProject } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";
import { toolHref } from "@/lib/workspace/tools";

export const metadata: Metadata = { title: "Kit styles" };

/** A design that is missing, or belongs to another brand, is a page that does not exist. */
const orNotFound = (error: unknown): never => {
  if (error instanceof AppError && error.code === "not_found") notFound();
  throw error;
};

const fromParam = (value: unknown): GalleryFrom => GALLERY_FROM.find((entry) => entry === value) ?? "editor";

/** Owner decision 2026-10-13: style starting points for clubs, picked at the start of a design. */
export default async function KitStylesPage({ params, searchParams }: PageProps<"/studio/[projectId]/kit-styles">) {
  const { brand } = await requireMember();
  const { projectId } = await params;
  const query = await searchParams;
  const client = await sessionClient();
  const [project, charts] = await Promise.all([getProject(client, brand.id, projectId), brandChartSet(client, brand.id)]).catch(orNotFound);

  const from = fromParam(query.from);
  const colours = readClubColours(query, clubColoursFrom(project.spec));
  const backHref = (from === "guide" ? guideAddress(projectId, "start") : toolHref(projectId, "colours")) as Route;
  const tiles = kitStyleTiles(project.spec, colours, charts);
  if (tiles.length === 0) notFound();

  // The club's own colours: the main colour is the cloth the pattern is drawn on, the other one or
  // two are its inks. A generator given fewer colours than it can take uses what it is given.
  const inks = [colours.second, colours.third].filter((ink): ink is string => ink !== null);
  const looks = galleryTiles(inks, colours.main);
  const offered = kitStylesFor(project.spec.typeId).map((style) => style.id);

  return (
    <div className="flex flex-col gap-10">
      <KitStyleGallery
        projectId={projectId}
        version={project.currentVersion}
        typeLabel={project.garmentLabel}
        tiles={tiles}
        colours={colours}
        from={from}
        backHref={backHref}
      />
      <PatternLooks tiles={looks} offered={offered} />
    </div>
  );
}

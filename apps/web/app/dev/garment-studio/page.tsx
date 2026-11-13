import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GarmentStudio } from "@/components/garment-studio/GarmentStudio";
import { DesignIdProvider } from "@/components/production/DesignId";
import { devStudio } from "@/lib/garment-studio/fixtures/dev";
import { parseShelf } from "@/lib/garment-studio/shelves";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Garment Studio fixture", robots: { index: false, follow: false } };

/**
 * Garment Studio with made-up data (decision 0150), for the 1440 × 900 comparisons:
 *
 *   ?shelf=fabrics (s02) · colours (s04) · repeats (s05) · graphics (s06) · trims (s07)
 *   · &view=2d (s03) · &welcome=1 (s01)
 *
 * The Export panel (s16), the colourway and size menus (s17, s18) and the upgrade modal (s19) open
 * from the page. It reads nothing and needs no session; a change pressed here is not saved. A
 * production build answers 404 unless DEV_UI_ROUTES is "on".
 */
export default async function GarmentStudioFixture({ searchParams }: PageProps<"/dev/garment-studio">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const query = await searchParams;
  const studio = devStudio(query);
  const { state } = studio;
  return (
    <DesignIdProvider projectId={studio.data.projectId}>
      <GarmentStudio
        backHref={"/dev/canvas" as Route}
        canvasName="Lahore Lions · Home kit launch (made up)"
        credits={1240}
        club={studio.club}
        shelf={parseShelf(query.shelf)}
        welcome={query.welcome === "1"}
        data={studio.data}
        assistant={{ available: false, conversation: [] }}
        show3d={false}
        article={studio.article}
        segment={state.segment}
        view={state.view}
        beside={state.beside}
        size={state.size}
        sizes={state.sizes}
        form={state.form}
        draft={state.draft}
        model={state.model}
        checks={studio.checks}
        slots={{ kitStyles: null, photoreal: null, share: null, quote: null, organisation: null, designImport: null }}
      />
    </DesignIdProvider>
  );
}

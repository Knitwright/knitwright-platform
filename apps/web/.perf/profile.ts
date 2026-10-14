// Scratch: times the pure pieces of the two pages. Not committed.
import { createAdminClient } from "@/lib/supabase/clients";
import { brandChartSet } from "@/lib/charts/service";
import { getProjectAt } from "@/lib/projects/service";
import { cardFacts } from "@/lib/home/card";
import { buildPackFor, buildTechPackPage } from "@/lib/projects/tech-pack-data";
import { completenessReport, flatsForTechPack } from "@/lib/techpack";
import { colourwayDrawing } from "@/lib/techpack/flats";
import { renderSvg, svgDataUri } from "@/lib/flat/render-svg";

const settings = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL!,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY!,
};

const time = (label: string, n: number, fn: () => unknown) => {
  for (let i = 0; i < 3; i++) fn();
  const t = performance.now();
  for (let i = 0; i < n; i++) fn();
  console.log(label, ((performance.now() - t) / n).toFixed(2), "ms");
};

async function main() {
  const admin = createAdminClient(settings);
  const { data } = await admin.from("projects").select("id, brand_id").order("created_at", { ascending: false }).limit(7);
  for (const row of data ?? []) {
    const charts = await brandChartSet(admin, row.brand_id);
    const project = await getProjectAt(admin, row.brand_id, row.id);
    const input = { project, history: { versions: [], hasMore: false }, brandName: "B", images: new Map(), now: new Date(), charts };
    console.log("---", project.spec.typeId);
    time("cardFacts", 20, () => cardFacts(project, "B", charts, new Date()));
    time("flatsForTechPack", 20, () => flatsForTechPack(project.spec, charts));
    time("buildPackFor", 20, () => buildPackFor(input));
    const pack = buildPackFor(input);
    time("completenessReport", 20, () => completenessReport(pack));
    const first = project.spec.colourways[0]!;
    time("colourwayDrawing", 20, () => colourwayDrawing(project.spec, first.id, charts));
    const front = colourwayDrawing(project.spec, first.id, charts);
    time("renderSvg+uri", 20, () => svgDataUri(renderSvg(front.model!)));
    time("buildTechPackPage", 20, () => buildTechPackPage(input));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

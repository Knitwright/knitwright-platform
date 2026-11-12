import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CanvasWorkflow } from "@/components/ai-studio/CanvasWorkflow";
import { CreativeAgent } from "@/components/ai-studio/CreativeAgent";
import { GeneratorPage } from "@/components/ai-studio/GeneratorPage";
import { StudioHome } from "@/components/ai-studio/StudioHome";
import { AppShell } from "@/components/shell/AppShell";
import { QUICK_STARTS } from "@/lib/ai-studio/agent";
import { ALL_OFF, availabilityOf } from "@/lib/ai-studio/availability";
import { GENERATORS, workflowById } from "@/lib/ai-studio/catalogue";
import { formOf } from "@/lib/ai-studio/forms";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = {
  title: "AI Studio fixture",
  robots: { index: false, follow: false },
};

/**
 * AI Studio with made-up data (decision 0141), for the 1440 × 900 comparisons with d07–d12. It reads
 * nothing and needs no session; a production build answers 404 unless DEV_UI_ROUTES is "on".
 * `?page=agent`, `workflow` (Kit launch ad), `gated` (On-model try-on, switched off), `image` and
 * `video` open the other screens.
 */

const PRODUCTS = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Northfield FC home", garment: "Team jersey", typeId: "team-jersey" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Away kit 2027", garment: "Crew neck tee", typeId: "crew-tee" },
];

function Screen({ page }: Readonly<{ page: string }>) {
  const framed = (id: string) => {
    const workflow = workflowById(id)!;
    return { id, title: workflow.title, lead: workflow.lead, tone: workflow.tone, poweredBy: workflow.poweredBy };
  };
  switch (page) {
    case "agent":
      return <CreativeAgent brandName="Northfield FC" initialKind="team_kit" quickStarts={QUICK_STARTS} history={[]} say="" sketch={false} />;
    case "workflow":
      return <CanvasWorkflow workflow={framed("kit-launch-ad")} form={formOf("kit-launch-ad")!} products={PRODUCTS} availability={{ available: true }} creditsPer={0} />;
    case "gated":
      return <CanvasWorkflow workflow={framed("on-model-try-on")} form={formOf("on-model-try-on")!} products={PRODUCTS} availability={availabilityOf(workflowById("on-model-try-on")!, ALL_OFF)} creditsPer={1} />;
    case "image":
      return <GeneratorPage generator={GENERATORS[0]!} products={PRODUCTS} availability={{ available: true }} creditsPer={1} />;
    case "video":
      return <GeneratorPage generator={GENERATORS[1]!} products={PRODUCTS} availability={{ available: true }} creditsPer={0} perSecond={1} />;
    default:
      return <StudioHome />;
  }
}

export default async function DevAiStudioPage({ searchParams }: PageProps<"/dev/ai-studio">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const query = await searchParams;
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Northfield FC", workspace: { isClub: true, setUp: false }, credits: 1240 }}>
      <Screen page={typeof query.page === "string" ? query.page : "home"} />
    </AppShell>
  );
}

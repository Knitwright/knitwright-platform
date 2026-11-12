import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { BenchmarkWorkflow } from "@/components/ai-studio/BenchmarkWorkflow";
import { BrandBoard } from "@/components/ai-studio/BrandBoard";
import { CanvasWorkflow } from "@/components/ai-studio/CanvasWorkflow";
import { VariantWorkflow } from "@/components/ai-studio/VariantWorkflow";
import { WorkflowFrame } from "@/components/ai-studio/WorkflowFrame";
import { CrestToKit } from "@/components/crest-to-kit/CrestToKit";
import { availabilityOf } from "@/lib/ai-studio/availability";
import { workflowById, type Workflow } from "@/lib/ai-studio/catalogue";
import { formOf, type Option } from "@/lib/ai-studio/forms";
import { patternFamiliesFor } from "@/lib/ai-studio/remix";
import { creditsPerOutput, liveSwitches, loadProducts } from "@/lib/ai-studio/server";
import { benchmarkStore } from "@/lib/benchmarks/server";
import { CLUB_PALETTE } from "@/lib/kit-styles/presets";
import { requireMember } from "@/lib/server/page-guards";
import { SPORTS } from "@/lib/teamwear/vocabulary";

/**
 * One AI Studio workflow (`09` screen 4, the "AI workflows at launch" table; decision 0141). The
 * workflow's engine decides the form: the moved crest-to-kit and benchmarks screens, a canvas
 * workflow's numbered form, the remix and recolour variants, or the brand board.
 */

export async function generateMetadata({ params }: PageProps<"/ai-studio/workflow/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: workflowById(id)?.title ?? "Workflow" };
}

type Member = Awaited<ReturnType<typeof requireMember>>;

async function Body({ workflow, member }: Readonly<{ workflow: Workflow; member: Member }>) {
  const framed = { id: workflow.id, title: workflow.title, lead: workflow.lead, tone: workflow.tone, poweredBy: workflow.poweredBy };
  switch (workflow.engine) {
    case "crest":
      return (
        <WorkflowFrame {...framed} wide>
          <CrestToKit sports={SPORTS.map((sport) => ({ id: sport.id, label: sport.label }))} swatches={CLUB_PALETTE.map((entry) => ({ name: entry.name, swatch: entry.swatch }))} />
        </WorkflowFrame>
      );
    case "benchmark": {
      const benchmarks = await (await benchmarkStore()).list({ brandId: member.brand.id, userId: member.userId });
      return (
        <WorkflowFrame {...framed} wide>
          <BenchmarkWorkflow brandName={member.brand.name} benchmarks={benchmarks} />
        </WorkflowFrame>
      );
    }
    case "brand-board":
      return <BrandBoard workflow={framed} sportId={SPORTS[0]?.id ?? ""} />;
    case "remix":
    case "recolour": {
      const products = await loadProducts(member.brand.id);
      const families: Record<string, readonly Option[]> = {};
      for (const product of products) families[product.typeId] ??= patternFamiliesFor(product.typeId).map((one) => ({ value: one.id, label: one.label }));
      return <VariantWorkflow workflow={framed} mode={workflow.engine} products={products} families={families} />;
    }
    default: {
      const form = formOf(workflow.id);
      if (form === null) notFound();
      const products = await loadProducts(member.brand.id);
      return <CanvasWorkflow workflow={framed} form={form} products={products} availability={availabilityOf(workflow, liveSwitches())} creditsPer={creditsPerOutput(workflow)} />;
    }
  }
}

export default async function AiWorkflowPage({ params }: PageProps<"/ai-studio/workflow/[id]">) {
  const member = await requireMember();
  const { id } = await params;
  const workflow = workflowById(id);
  if (workflow === null) notFound();
  if (workflow.engine === "link" && workflow.href) redirect(workflow.href as Route);
  return <Body workflow={workflow} member={member} />;
}

import { TopBarTabs } from "@/components/shell/TopBarSlot";
import type { Availability } from "@/lib/ai-studio/availability";
import type { Workflow } from "@/lib/ai-studio/catalogue";
import { formOf } from "@/lib/ai-studio/forms";
import type { Answers } from "@/lib/ai-studio/answers";
import { AI_STUDIO_TABS } from "@/lib/shell/tabs";
import { CanvasWorkflow } from "./CanvasWorkflow";
import type { ProductOption } from "./Fields";

/**
 * The Image and Video generator tabs (`09` screens 5–6, prototype d11/d12; decision 0141): the same
 * page format as a workflow, under AI Studio's tabs. The reference is always one of the brand's own
 * designs, drawn by the platform and locked (🔒), and the run happens on the launch board, whose
 * panel (`components/shoots/AiImageBoardPanel.tsx`, `components/video/AiVideoPanel.tsx`) reads the
 * same settings this form writes. The credits come from `lib/credits` settings.
 */

type Props = Readonly<{
  generator: Workflow;
  products: readonly ProductOption[];
  availability: Availability;
  creditsPer: number;
  perSecond?: number;
  initial?: Answers;
}>;

export function GeneratorPage({ generator, products, availability, creditsPer, perSecond, initial }: Props) {
  const form = formOf(generator.id);
  if (form === null) return null;
  const framed = { id: generator.id, title: generator.title, lead: generator.lead, tone: generator.tone, poweredBy: generator.poweredBy };
  return (
    <>
      <TopBarTabs label="AI Studio" tabs={AI_STUDIO_TABS} />
      <CanvasWorkflow workflow={framed} form={form} products={products} availability={availability} creditsPer={creditsPer} perSecond={perSecond} back={false} initial={initial} />
    </>
  );
}

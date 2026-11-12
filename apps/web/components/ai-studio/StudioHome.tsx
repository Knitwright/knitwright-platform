import { TopBarTabs } from "@/components/shell/TopBarSlot";
import { IMAGE_STYLES } from "@/lib/ai-studio/forms";
import { AI_STUDIO_TABS } from "@/lib/shell/tabs";
import { AskAgentCard } from "./AskAgentCard";
import { WorkflowHub } from "./WorkflowHub";

/**
 * AI Studio's home, which is AI Workflows (`09` screens 2–3, v3.2; prototype d07): the grey hero
 * with its faint grid, "What do you want to create today?" and the Ask Creative Agent card, then
 * Start a workflow. It reads nothing, so it needs no database: `/dev/ai-studio` draws the same.
 */
export function StudioHome() {
  return (
    <>
      <TopBarTabs label="AI Studio" tabs={AI_STUDIO_TABS} />
      <h1 className="sr-only">AI Workflows</h1>
      <div className="flex flex-col gap-12 pt-2">
        <section aria-labelledby="hero-heading" className="studio-hero flex flex-col items-center gap-14 rounded-3xl px-6 pt-16 pb-20">
          <h2 id="hero-heading" className="text-center text-display text-on-dark">
            What do you want to create today?
          </h2>
          <AskAgentCard />
        </section>
        <WorkflowHub styles={IMAGE_STYLES} />
      </div>
    </>
  );
}

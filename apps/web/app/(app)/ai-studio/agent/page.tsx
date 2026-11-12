import type { Metadata } from "next";
import { CreativeAgent } from "@/components/ai-studio/CreativeAgent";
import { TopBarTabs } from "@/components/shell/TopBarSlot";
import { QUICK_STARTS } from "@/lib/ai-studio/agent";
import { MAX_PROMPT_LENGTH } from "@/lib/ai-studio/agent-address";
import { loadAgentHistory } from "@/lib/ai-studio/server";
import { defaultBuyerKind } from "@/lib/leads/buyer-kind";
import { getBrandDetails } from "@/lib/leads/service";
import { sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { requireMember } from "@/lib/server/page-guards";
import { AI_STUDIO_TABS } from "@/lib/shell/tabs";

export const metadata: Metadata = { title: "Creative Agent" };

/** The Creative Agent (`09` screen 2; decision 0141), over the design chat and Ask. */
export default async function CreativeAgentPage({ searchParams }: PageProps<"/ai-studio/agent">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const say = typeof query.say === "string" ? query.say.slice(0, MAX_PROMPT_LENGTH) : "";
  const [initialKind, history] = await Promise.all([
    getBrandDetails(await sessionClient(), brand.id).then(defaultBuyerKind, (error: unknown) => {
      log({ level: "warn", message: "The brand details could not be read", where: "page ai-studio-agent", error });
      return "" as const;
    }),
    loadAgentHistory(brand.id),
  ]);
  return (
    <>
      <TopBarTabs label="AI Studio" tabs={AI_STUDIO_TABS} />
      <div className="pt-2">
        <CreativeAgent brandName={brand.name} initialKind={initialKind} quickStarts={QUICK_STARTS} history={history} say={say} sketch={query.from === "sketch"} />
      </div>
    </>
  );
}

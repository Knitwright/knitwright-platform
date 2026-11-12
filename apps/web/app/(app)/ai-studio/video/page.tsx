import type { Metadata } from "next";
import { GeneratorPage } from "@/components/ai-studio/GeneratorPage";
import { availabilityOf } from "@/lib/ai-studio/availability";
import { GENERATORS } from "@/lib/ai-studio/catalogue";
import { liveSwitches, loadProducts } from "@/lib/ai-studio/server";
import { PLACEHOLDER_CREDITS_PER_SECOND } from "@/lib/media/video/models";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Video Generator" };

/** The Video generator (`09` screen 6; decision 0141): credits a second times the length, shown first. */
export default async function VideoGeneratorPage() {
  const { brand } = await requireMember();
  const generator = GENERATORS[1]!;
  return (
    <GeneratorPage
      generator={generator}
      products={await loadProducts(brand.id)}
      availability={availabilityOf(generator, liveSwitches())}
      creditsPer={0}
      perSecond={PLACEHOLDER_CREDITS_PER_SECOND}
    />
  );
}

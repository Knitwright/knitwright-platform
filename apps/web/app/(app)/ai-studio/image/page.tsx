import type { Metadata } from "next";
import { GeneratorPage } from "@/components/ai-studio/GeneratorPage";
import { availabilityOf } from "@/lib/ai-studio/availability";
import { GENERATORS } from "@/lib/ai-studio/catalogue";
import { IMAGE_STYLES } from "@/lib/ai-studio/forms";
import { creditsPerOutput, liveSwitches, loadProducts } from "@/lib/ai-studio/server";
import { MODEL_PRESET_CATALOGUE } from "@/lib/shoots/models";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Image Generator" };

/** The Image generator (`09` screen 5; decision 0141). `?style=` comes from the Browse styles drawer. */
export default async function ImageGeneratorPage({ searchParams }: PageProps<"/ai-studio/image">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const generator = GENERATORS[0]!;
  const style = IMAGE_STYLES.find((one) => one.value === query.style)?.value;
  const model = query.model === "preset" ? MODEL_PRESET_CATALOGUE[0]?.key : undefined;
  const initial = { ...(style ? { style } : {}), ...(model ? { model } : {}) };
  return (
    <GeneratorPage
      generator={generator}
      products={await loadProducts(brand.id)}
      availability={availabilityOf(generator, liveSwitches())}
      creditsPer={creditsPerOutput(generator)}
      initial={initial}
    />
  );
}

import type { Metadata } from "next";
import { GuidedStart } from "@/components/guided/GuidedStart";
import { FormPage } from "@/components/shell/PageIntro";
import { defaultBuyerKind } from "@/lib/leads/buyer-kind";
import { getBrandDetails } from "@/lib/leads/service";
import { garmentTypeGroups } from "@/lib/projects/type-groups";
import { WEARER_OPTIONS } from "@/lib/projects/wearers";
import { sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Start a design" };

/** The start of the guided flow (plan step 15): words, a picture, or a garment picker. */
export default async function StartPage() {
  const { brand } = await requireMember();
  // The path ticked at first. Without the brand's details the person simply chooses it.
  const initialKind = await getBrandDetails(await sessionClient(), brand.id).then(
    defaultBuyerKind,
    (error: unknown) => {
      log({ level: "warn", message: "The brand details could not be read", where: "page studio-start", error });
      return "";
    },
  );

  return (
    <FormPage
      eyebrow={brand.name}
      title="Start a design"
      lead="Start, check the drawing and measurements, adjust, and download the files a factory needs. Then share the design with your committee and ask for a quote."
    >
      <GuidedStart types={garmentTypeGroups()} wearers={WEARER_OPTIONS} initialKind={initialKind} />
    </FormPage>
  );
}

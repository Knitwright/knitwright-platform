import type { Metadata } from "next";
import { GuidedStart } from "@/components/guided/GuidedStart";
import { garmentTypeGroups } from "@/lib/projects/type-groups";
import { WEARER_OPTIONS } from "@/lib/projects/wearers";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Start a design" };

/** The start of the guided flow (plan step 15): words, a picture, or a garment picker. */
export default async function StartPage() {
  const { brand } = await requireMember();

  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-wider text-muted">{brand.name}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Start a design</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Four steps: start, check the drawing and measurements, adjust, then download the files a factory needs.
      </p>
      <div className="mt-6">
        <GuidedStart types={garmentTypeGroups()} wearers={WEARER_OPTIONS} />
      </div>
    </div>
  );
}

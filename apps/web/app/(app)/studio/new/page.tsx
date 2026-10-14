import type { Metadata } from "next";
import { FormPage } from "@/components/shell/PageIntro";
import { NewDesignForm } from "@/components/studio/NewDesignForm";
import { garmentTypeGroups } from "@/lib/projects/type-groups";
import { WEARER_OPTIONS } from "@/lib/projects/wearers";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "New design" };

export default async function NewDesignPage() {
  const { brand } = await requireMember();
  const types = garmentTypeGroups();

  return (
    <FormPage
      eyebrow={brand.name}
      title="New design"
      lead="Choose a garment and who it is for. You can change every option afterwards."
    >
      <div className="max-w-2xl rounded-2xl border border-hairline bg-surface p-6 md:p-8">
        <NewDesignForm types={types} wearers={WEARER_OPTIONS} />
      </div>
    </FormPage>
  );
}

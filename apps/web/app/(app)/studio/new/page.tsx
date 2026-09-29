import type { Metadata } from "next";
import { NewDesignForm } from "@/components/studio/NewDesignForm";
import { listTypes } from "@/lib/garment";
import { WEARER_OPTIONS } from "@/lib/projects/wearers";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "New design" };

export default async function NewDesignPage() {
  const { brand } = await requireMember();
  const types = listTypes("tops").map((type) => ({ id: type.id, label: type.label }));

  return (
    <div className="max-w-xl">
      <p className="font-mono text-xs uppercase tracking-wider text-muted">{brand.name}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">New design</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Choose a garment and who it is for. You can change every option afterwards.
      </p>
      <div className="mt-6 rounded-2xl border border-hairline bg-surface p-6">
        <NewDesignForm types={types} wearers={WEARER_OPTIONS} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage() {
  const { brand } = await requireMember();

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">{brand.name}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Your designs</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
        Designs will appear here once the editor is ready. Only members of {brand.name} will be
        able to see them.
      </p>
    </>
  );
}

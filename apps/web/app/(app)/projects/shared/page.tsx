import { Users } from "lucide-react";
import type { Metadata } from "next";
import { SharedGrid } from "@/components/projects/v3/SharedGrid";
import { EmptyList } from "@/components/projects/v3/States";
import { SubNav } from "@/components/projects/v3/SubNav";
import { Icon } from "@/components/ui/Icon";
import { searchFromQuery, sortFromQuery } from "@/lib/projects-page/items";
import { loadShared } from "@/lib/projects-page/load";
import { SHARED_PATH } from "@/lib/projects-page/paths";
import type { SharedItem } from "@/lib/projects-page/rows";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Shared with you" };

const ORDER = {
  recent: (a: SharedItem, b: SharedItem) => b.invitedAt.localeCompare(a.invitedAt),
  oldest: (a: SharedItem, b: SharedItem) => a.invitedAt.localeCompare(b.invitedAt),
  name: (a: SharedItem, b: SharedItem) => a.projectName.localeCompare(b.projectName, "en-GB", { sensitivity: "base" }),
} as const;

/** Shared (d04): designs other brands invited this person to, by their confirmed email address. */
export default async function SharedPage({ searchParams }: PageProps<"/projects/shared">) {
  await requireMember();
  const query = await searchParams;
  const view = { sort: sortFromQuery(query.sort), search: searchFromQuery(query.q) };
  const shared = await loadShared(await sessionClient());
  const needle = view.search.toLocaleLowerCase("en-GB");
  const shown = shared
    .filter((item) => `${item.projectName} ${item.brandName}`.toLocaleLowerCase("en-GB").includes(needle))
    .toSorted(ORDER[view.sort]);

  return (
    <>
      <h1 className="text-h2 text-text md:sr-only">Shared with you</h1>
      <SubNav current="shared" path={SHARED_PATH} {...view} />
      {shown.length > 0 ? (
        <SharedGrid shared={shown} />
      ) : (
        <EmptyList icon={<Icon icon={Users} size={22} />} title={shared.length === 0 ? "Nothing shared with you yet" : "Nothing shared has that name"}>
          <p>{shared.length === 0 ? "Designs another club or brand invites you to by email appear here." : "Try another word, or clear the search."}</p>
        </EmptyList>
      )}
    </>
  );
}

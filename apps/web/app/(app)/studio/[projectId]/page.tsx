import { permanentRedirect } from "next/navigation";
import { movedHref } from "@/lib/canvas/address";
import { requireMember } from "@/lib/server/page-guards";

/**
 * A design opens on the one canvas (decision 0145). `next.config`'s 308 answers a browser that asks
 * for this address; this page answers what never reaches that rule -- a server action's redirect and
 * the client router's own navigation -- with the same destination, its query carried.
 */
export default async function MovedDesignPage({ params, searchParams }: PageProps<"/studio/[projectId]">) {
  await requireMember();
  const { projectId } = await params;
  permanentRedirect(movedHref(projectId, await searchParams, true));
}
